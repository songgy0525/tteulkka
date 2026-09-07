package com.tteulkka.backend.store.loader;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
public class NationwideLoaderService {

    private static final String JOB_NAME = "nationwide";

    private final AdmDongRepository admDongRepository;
    private final StoreDataLoaderService storeDataLoaderService;
    private final JdbcTemplate jdbcTemplate;
    private final Executor executor;

    /** JVM-local 빠른 가드 (같은 인스턴스 중복 제출 방지) */
    private final AtomicBoolean running = new AtomicBoolean(false);

    public NationwideLoaderService(
            AdmDongRepository admDongRepository,
            StoreDataLoaderService storeDataLoaderService,
            JdbcTemplate jdbcTemplate,
            @Qualifier("nationwideLoader") Executor executor) {
        this.admDongRepository = admDongRepository;
        this.storeDataLoaderService = storeDataLoaderService;
        this.jdbcTemplate = jdbcTemplate;
        this.executor = executor;
    }

    public boolean isRunning() {
        return running.get();
    }

    /**
     * JVM 락 → DB 전역 락 순서로 선점.
     * 두 인스턴스가 동시에 호출해도 DB UPDATE 원자성으로 하나만 성공한다.
     *
     * @return true = 시작됨, false = 이 JVM 또는 다른 인스턴스가 이미 실행 중
     */
    public boolean tryStart() {
        // 1단계: JVM-local 빠른 가드
        if (!running.compareAndSet(false, true)) {
            return false;
        }
        // 2단계: DB 전역 락 (running=false인 경우만 UPDATE 성공)
        if (!acquireDbLock()) {
            running.set(false); // 다른 인스턴스가 락 보유 중
            return false;
        }
        executor.execute(this::doLoadAll);
        return true;
    }

    private void doLoadAll() {
        log.info("전국 상권 데이터 적재 시작");
        try {
            while (!Thread.currentThread().isInterrupted()) {
                Optional<AdmDong> next = admDongRepository.findFirstByStatusOrderByCodeAsc(LoadStatus.PENDING);
                if (next.isEmpty()) {
                    log.info("전국 상권 데이터 적재 완료");
                    break;
                }

                AdmDong admDong = next.get();

                // 원자적 선점: 다른 인스턴스가 먼저 가져갔으면 0 반환
                if (admDongRepository.claimAsPending(admDong.getCode()) == 0) {
                    continue;
                }

                try {
                    int count = storeDataLoaderService.loadByAdmDong(admDong.getCode());
                    admDong.markDone(count);
                    log.info("[완료] {} {} {} → {}개",
                            admDong.getSido(), admDong.getSigungu(), admDong.getDong(), count);
                } catch (Exception e) {
                    admDong.markFailed();
                    log.warn("[실패] {} {} {}: {}",
                            admDong.getSido(), admDong.getSigungu(), admDong.getDong(), e.getMessage());
                }

                admDongRepository.save(admDong);
                Thread.sleep(200); // API rate limit 방지
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("전국 적재 중단됨");
        } finally {
            releaseDbLock();
            running.set(false);
        }
    }

    /** running=false일 때만 UPDATE 성공 → 원자적 전역 선점 */
    private boolean acquireDbLock() {
        int updated = jdbcTemplate.update(
                "UPDATE batch_lock SET running = true, started_at = now() WHERE job_name = ? AND running = false",
                JOB_NAME
        );
        return updated == 1;
    }

    private void releaseDbLock() {
        jdbcTemplate.update(
                "UPDATE batch_lock SET running = false, started_at = null WHERE job_name = ?",
                JOB_NAME
        );
    }
}
