package com.tteulkka.backend.store.loader;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record StoreApiResponse(
        Header header,
        Body body
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Header(String resultCode, String resultMsg) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Body(
            List<StoreApiItem> items,
            int numOfRows,
            int pageNo,
            int totalCount
    ) {}
}
