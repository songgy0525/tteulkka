package com.tteulkka.backend.store.loader;

import java.util.List;

public record StoreApiResponse(
        Body body
) {
    public record Body(
            List<StoreApiItem> items,
            int numOfRows,
            int pageNo,
            int totalCount
    ) {}
}
