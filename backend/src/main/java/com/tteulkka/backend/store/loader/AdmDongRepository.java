package com.tteulkka.backend.store.loader;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface AdmDongRepository extends JpaRepository<AdmDong, String> {

    Optional<AdmDong> findFirstByStatusOrderByCodeAsc(LoadStatus status);

    List<AdmDong> findAllByStatus(LoadStatus status);

    long countByStatus(LoadStatus status);

    /**
     * 원자적 선점: PENDING → LOADING (다른 인스턴스가 먼저 가져갔으면 0 반환)
     */
    @Modifying
    @Transactional
    @Query(value = "UPDATE adm_dong SET status = 'LOADING' WHERE code = :code AND status = 'PENDING'",
            nativeQuery = true)
    int claimAsPending(@Param("code") String code);

    /**
     * 앱 재시작 시 이전 크래시로 LOADING에 머문 행정동을 PENDING으로 복구
     */
    @Modifying
    @Transactional
    @Query(value = "UPDATE adm_dong SET status = 'PENDING' WHERE status = 'LOADING'",
            nativeQuery = true)
    int resetLoadingToPending();
}
