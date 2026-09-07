package com.tteulkka.backend.store.loader;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/data")
@RequiredArgsConstructor
public class StoreDataLoaderController {

    private final StoreDataLoaderService loaderService;

    @PostMapping("/load")
    public ResponseEntity<LoadResult> load(@RequestBody LoadRequest request) {
        int count = loaderService.loadByAdmDong(request.admDongCode());
        return ResponseEntity.ok(new LoadResult(request.admDongCode(), count));
    }

    public record LoadRequest(String admDongCode) {}
    public record LoadResult(String admDongCode, int loaded) {}
}
