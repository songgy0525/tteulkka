package com.tteulkka.backend.store;

public record StoreResponse(
        Long id,
        String name,
        String categoryCode,
        String categoryName,
        double lat,
        double lng,
        String address,
        String sido,
        String sigungu,
        String dong
) {
    static StoreResponse from(Store store) {
        return new StoreResponse(
                store.getId(),
                store.getName(),
                store.getCategoryCode(),
                store.getCategoryName(),
                store.getLocation().getY(),
                store.getLocation().getX(),
                store.getAddress(),
                store.getSido(),
                store.getSigungu(),
                store.getDong()
        );
    }
}
