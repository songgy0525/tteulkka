package com.tteulkka.backend.store;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stores")
@RequiredArgsConstructor
@Validated
public class StoreController {

    private final StoreService storeService;

    @GetMapping
    public ResponseEntity<List<StoreResponse>> getStores(
            @RequestParam @DecimalMin("33.0") @DecimalMax("38.9") double lat,
            @RequestParam @DecimalMin("124.0") @DecimalMax("132.0") double lng,
            @RequestParam(defaultValue = "1000") @Min(100) @Max(5000) int radius,
            @RequestParam(required = false) String category
    ) {
        return ResponseEntity.ok(storeService.findNearby(lat, lng, radius, category));
    }
}
