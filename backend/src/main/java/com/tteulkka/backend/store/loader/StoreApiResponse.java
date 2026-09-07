package com.tteulkka.backend.store.loader;

import java.util.List;

public record StoreApiResponse(
        Header header,
        Body body
) {
    public record Header(String resultCode, String resultMsg) {}

    public record Body(
            List<StoreApiItem> items,
            int numOfRows,
            int pageNo,
            int totalCount
    ) {}
}
