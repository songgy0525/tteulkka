package com.tteulkka.backend.store;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Set;

public interface StoreRepository extends JpaRepository<Store, Long> {

    @Query(value = """
            SELECT * FROM store
            WHERE ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                :radiusMeters
            )
            AND (:categoryCode IS NULL OR category_code = :categoryCode)
            AND status = 'ACTIVE'
            """, nativeQuery = true)
    List<Store> findWithinRadius(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radiusMeters") int radiusMeters,
            @Param("categoryCode") String categoryCode
    );

    @Query("SELECT s.bizesId FROM Store s WHERE s.bizesId IN :bizesIds")
    Set<String> findExistingBizesIds(@Param("bizesIds") Collection<String> bizesIds);
}
