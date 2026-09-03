package com.tteulkka.backend.store;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StoreService {

    private final StoreRepository storeRepository;

    @Transactional(readOnly = true)
    public List<StoreResponse> findNearby(double lat, double lng, int radiusMeters, String categoryCode) {
        return storeRepository.findWithinRadius(lat, lng, radiusMeters, categoryCode)
                .stream()
                .map(StoreResponse::from)
                .toList();
    }
}
