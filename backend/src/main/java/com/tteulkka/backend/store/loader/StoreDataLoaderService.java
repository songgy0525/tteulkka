package com.tteulkka.backend.store.loader;

import com.tteulkka.backend.store.Store;
import com.tteulkka.backend.store.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.Collection;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class StoreDataLoaderService {

    private final StoreRepository storeRepository;
    private final RestClient restClient;

    @Value("${public-data.api-key}")
    private String apiKey;

    @Value("${public-data.store-api-base-url}")
    private String baseUrl;

    private static final int PAGE_SIZE = 1000;
    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Transactional
    public int loadByAdmDong(String admDongCode) {
        int pageNo = 1;
        int totalLoaded = 0;
        int totalCount = Integer.MAX_VALUE;

        while (totalLoaded < totalCount) {
            StoreApiResponse response = fetchPage(admDongCode, pageNo);

            if (response.body() == null || response.body().items() == null || response.body().items().isEmpty()) {
                break;
            }

            totalCount = response.body().totalCount();

            List<Store> stores = response.body().items().stream()
                    .filter(this::hasValidCoordinates)
                    .map(this::toStore)
                    .toList();

            int saved = saveNewStores(stores);
            totalLoaded += response.body().items().size();
            log.info("행정동={} page={} 누적={}/{} 저장={}", admDongCode, pageNo, totalLoaded, totalCount, saved);
            pageNo++;
        }

        return totalLoaded;
    }

    private StoreApiResponse fetchPage(String admDongCode, int pageNo) {
        return restClient.get()
                .uri(baseUrl + "/storeListInAdmDong", builder -> builder
                        .queryParam("serviceKey", apiKey)
                        .queryParam("pageNo", pageNo)
                        .queryParam("numOfRows", PAGE_SIZE)
                        .queryParam("divId", "adongCd")
                        .queryParam("key", admDongCode)
                        .queryParam("type", "json")
                        .build())
                .retrieve()
                .body(StoreApiResponse.class);
    }

    private boolean hasValidCoordinates(StoreApiItem item) {
        return item.lon() != null && item.lat() != null
                && !item.lon().isBlank() && !item.lat().isBlank();
    }

    private Store toStore(StoreApiItem item) {
        double lng = Double.parseDouble(item.lon());
        double lat = Double.parseDouble(item.lat());
        Point point = GEOMETRY_FACTORY.createPoint(new Coordinate(lng, lat));

        return Store.create(
                item.bizesId(),
                item.bizesNm(),
                item.indsSclsCd() != null ? item.indsSclsCd() : "ETC",
                item.indsSclsNm() != null ? item.indsSclsNm() : "기타",
                point,
                item.rdnmAdr(),
                item.ctprvnNm(),
                item.signguNm(),
                item.adongNm()
        );
    }

    private int saveNewStores(List<Store> stores) {
        Collection<String> bizesIds = stores.stream()
                .map(Store::getBizesId)
                .toList();

        Set<String> existing = storeRepository.findExistingBizesIds(bizesIds);

        List<Store> newStores = stores.stream()
                .filter(s -> !existing.contains(s.getBizesId()))
                .toList();

        storeRepository.saveAll(newStores);
        return newStores.size();
    }
}
