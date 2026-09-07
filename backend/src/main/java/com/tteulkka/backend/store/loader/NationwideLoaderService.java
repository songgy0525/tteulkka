package com.tteulkka.backend.store.loader;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
@RequiredArgsConstructor
public class NationwideLoaderService {

    private final AdmDongRepository admDongRepository;
    private final StoreDataLoaderService storeDataLoaderService;

    private final AtomicBoolean running = new AtomicBoolean(false);

    public boolean isRunning() {
        return running.get();
    }

    @Async("nationwideLoader")
    public void startLoadAll() {
        if (!running.compareAndSet(false, true)) {
            log.warn("이미 전국 적재가 실행 중입니다.");
            return;
        }

        log.info("전국 상권 데이터 적재 시작");
        try {
            while (true) {
                Optional<AdmDong> next = admDongRepository.findFirstByStatusOrderByCodeAsc(LoadStatus.PENDING);
                if (next.isEmpty()) {
                    log.info("전국 상권 데이터 적재 완료");
                    break;
                }

                AdmDong admDong = next.get();
                try {
                    int count = storeDataLoaderService.loadByAdmDong(admDong.getCode());
                    admDong.markDone(count);
                    log.info("[완료] {} {} {} → {}개", admDong.getSido(), admDong.getSigungu(), admDong.getDong(), count);
                } catch (Exception e) {
                    admDong.markFailed();
                    log.warn("[실패] {} {} {}: {}", admDong.getSido(), admDong.getSigungu(), admDong.getDong(), e.getMessage());
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
