package com.tteulkka.backend.store.loader;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/data")
@RequiredArgsConstructor
public class NationwideLoaderController {

    @Value("${admin.secret-key}")
    private String adminSecretKey;

    private final NationwideLoaderService nationwideLoaderService;
    private final AdmDongRepository admDongRepository;

    /** 전국 적재 시작 (비동기 — 즉시 202 반환) */
    @PostMapping("/load-all")
    public ResponseEntity<Map<String, Object>> loadAll(
            @RequestHeader("X-Admin-Key") String key) {
        if (!adminSecretKey.equals(key)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        boolean started = nationwideLoaderService.tryStart();
        if (!started) {
            return ResponseEntity.ok(Map.of("message", "이미 적재 중입니다.", "running", true));
        }
        return ResponseEntity.accepted().body(Map.of("message", "전국 데이터 적재를 시작했습니다.", "running", true));
    }

    /** 실패한 행정동을 PENDING으로 되돌려서 재시도 가능하게 */
    @PostMapping("/reset-failed")
    public ResponseEntity<Map<String, Object>> resetFailed(
            @RequestHeader("X-Admin-Key") String key) {
        if (!adminSecretKey.equals(key)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        List<AdmDong> failed = admDongRepository.findAllByStatus(LoadStatus.FAILED);
        failed.forEach(AdmDong::resetToPending);
        admDongRepository.saveAll(failed);
        return ResponseEntity.ok(Map.of("reset", failed.size()));
    }

    /** 진행 상황 조회 */
    @GetMapping("/load-progress")
    public ResponseEntity<Map<String, Object>> progress(
            @RequestHeader("X-Admin-Key") String key) {
        if (!adminSecretKey.equals(key)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        long total   = admDongRepository.count();
        long done    = admDongRepository.countByStatus(LoadStatus.DONE);
        long loading = admDongRepository.countByStatus(LoadStatus.LOADING);
        long failed  = admDongRepository.countByStatus(LoadStatus.FAILED);
        long pending = admDongRepository.countByStatus(LoadStatus.PENDING);

        return ResponseEntity.ok(Map.of(
                "total",   total,
                "done",    done,
                "loading", loading,
                "pending", pending,
                "failed",  failed,
                "running", nationwideLoaderService.isRunning()
        ));
    }
}
