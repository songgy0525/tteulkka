package com.tteulkka.backend.store.loader;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record StoreApiItem(
        String bizesId,
        String bizesNm,
        String indsSclsCd,
        String indsSclsNm,
        String ctprvnNm,
        String signguNm,
        String adongNm,
        String rdnmAdr,
        Double lon,
        Double lat
) {}
