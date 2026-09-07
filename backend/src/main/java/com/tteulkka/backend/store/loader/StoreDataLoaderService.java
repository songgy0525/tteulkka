package com.tteulkka.backend.store.loader;

import com.tteulkka.backend.store.Store;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class StoreDataLoaderService {

    private final StorePersistenceService persistenceService;
    private final RestClient restClient;

    @Value("${public-data.api-key}")
    private String apiKey;

    @Value("${public-data.store-api-base-url}")
    private String baseUrl;

    private static final int PAGE_SIZE = 1000;
    private static final String SUCCESS_CODE = "00";
    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    // HTTP 조회는 트랜잭션 밖에서, 페이지 단위 저장은 StorePersistenceService의 짧은 트랜잭션으로 처리
    public int loadByAdmDong(String admDongCode) {
        int pageNo = 1;
        int totalFetched = 0;
        int totalSaved = 0;
        int totalCount = Integer.MAX_VALUE;

        while (totalFetched < totalCount) {
            StoreApiResponse response = fetchPage(admDongCode, pageNo);

            if (response.header() != null && !SUCCESS_CODE.equals(response.header().resultCode())) {
                throw new IllegalStateException(
                        "공공데이터 API 오류: " + response.header().resultCode()
                        + " - " + response.header().resultMsg()
                );
            }

            if (response.body() == null || response.body().items() == null || response.body().items().isEmpty()) {
                break;
            }

            totalCount = response.body().totalCount();
            int fetchedThisPage = response.body().items().size();

            List<Store> stores = response.body().items().stream()
                    .filter(this::hasValidCoordinates)
                    .map(this::toStore)
                    .toList();

            int saved = persistenceService.saveNewStores(stores);
            totalFetched += fetchedThisPage;
            totalSaved += saved;
            log.info("행정동={} page={} 누적={}/{} 저장={}", admDongCode, pageNo, totalFetched, totalCount, saved);
            pageNo++;
        }

        return totalSaved;
    }

    private StoreApiResponse fetchPage(String admDongCode, int pageNo) {
        String encodedKey = URLEncoder.encode(apiKey, StandardCharsets.UTF_8);
        String url = String.format(
                "%s/storeListInDong?serviceKey=%s&pageNo=%d&numOfRows=%d&divId=adongCd&key=%s&type=json",
                baseUrl, encodedKey, pageNo, PAGE_SIZE, admDongCode
        );
        return restClient.get()
                .uri(URI.create(url))
                .retrieve()
                .body(StoreApiResponse.class);
    }

    private boolean hasValidCoordinates(StoreApiItem item) {
        return item.lon() != null && item.lat() != null;
    }

    private Store toStore(StoreApiItem item) {
        double lng = item.lon();
        double lat = item.lat();
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
}
