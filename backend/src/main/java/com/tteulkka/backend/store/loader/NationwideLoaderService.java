package com.tteulkka.backend.store.loader;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
public class NationwideLoaderService {

    private final AdmDongRepository admDongRepository;
    private final StoreDataLoaderService storeDataLoaderService;
    private final Executor executor;

    private final AtomicBoolean running = new AtomicBoolean(false);

    public NationwideLoaderService(
            AdmDongRepository admDongRepository,
            StoreDataLoaderService storeDataLoaderService,
            @Qualifier("nationwideLoader") Executor executor) {
        this.admDongRepository = admDongRepository;
        this.storeDataLoaderService = storeDataLoaderService;
        this.executor = executor;
    }

    public boolean isRunning() {
        return running.get();
    }

    /**
     * compareAndSet을 동기적으로 먼저 수행한 뒤 executor에 제출.
     * 두 요청이 동시에 들어와도 하나만 true를 받는다.
     *
     * @return true = 시작됨, false = 이미 실행 중
     */
    public boolean tryStart() {
        if (!running.compareAndSet(false, true)) {
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

                // 원자적 선점: 다른 인스턴스가 먼저 가져갔으면 PENDING → LOADING 업데이트 실패(0)
                if (admDongRepository.claimAsPending(admDong.getCode()) == 0) {
                    continue; // 다음 PENDING 탐색
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
            running.set(false);
        }
    }
}
