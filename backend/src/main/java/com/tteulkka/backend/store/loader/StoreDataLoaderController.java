package com.tteulkka.backend.store.loader;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/data")
@RequiredArgsConstructor
public class StoreDataLoaderController {

    private final StoreDataLoaderService loaderService;

    @Value("${admin.secret-key}")
    private String adminSecretKey;

    @PostMapping("/load")
    public ResponseEntity<LoadResult> load(
            @RequestHeader("X-Admin-Key") String key,
            @RequestBody LoadRequest request) {
        if (!adminSecretKey.equals(key)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        int count = loaderService.loadByAdmDong(request.admDongCode());
        return ResponseEntity.ok(new LoadResult(request.admDongCode(), count));
    }

    public record LoadRequest(String admDongCode) {}
    public record LoadResult(String admDongCode, int loaded) {}
}
