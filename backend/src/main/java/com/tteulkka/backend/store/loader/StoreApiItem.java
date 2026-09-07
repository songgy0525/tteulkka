package com.tteulkka.backend.store.loader;

public record StoreApiItem(
        String bizesId,
        String bizesNm,
        String indsSclsCd,
        String indsSclsNm,
        String ctprvnNm,
        String signguNm,
        String adongNm,
        String rdnmAdr,
        String lon,
        String lat
) {}
