package com.tteulkka.backend.store.loader;

import com.tteulkka.backend.store.Store;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StorePersistenceService {

    private final JdbcTemplate jdbcTemplate;

    private static final String UPSERT_SQL = """
            INSERT INTO store
                (bizes_id, name, category_code, category_name, location, address, sido, sigungu, dong, status, created_at, updated_at)
            VALUES
                (?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?, ?, ?, ?, 'ACTIVE', now(), now())
            ON CONFLICT (bizes_id) DO NOTHING
            """;

    @Transactional
    public int saveNewStores(List<Store> stores) {
        List<Store> deduplicated = stores.stream()
                .collect(Collectors.toMap(
                        Store::getBizesId,
                        s -> s,
                        (a, b) -> a,
                        LinkedHashMap::new
                ))
                .values().stream()
                .toList();

        int[][] results = jdbcTemplate.batchUpdate(UPSERT_SQL, deduplicated, 500,
                (ps, store) -> {
                    ps.setString(1, store.getBizesId());
                    ps.setString(2, store.getName());
                    ps.setString(3, store.getCategoryCode());
                    ps.setString(4, store.getCategoryName());
                    ps.setDouble(5, store.getLocation().getX()); // longitude
                    ps.setDouble(6, store.getLocation().getY()); // latitude
                    ps.setString(7, store.getAddress());
                    ps.setString(8, store.getSido());
                    ps.setString(9, store.getSigungu());
                    ps.setString(10, store.getDong());
                });

        return Arrays.stream(results)
                .flatMapToInt(Arrays::stream)
                .filter(r -> r > 0)
                .sum();
    }
}
