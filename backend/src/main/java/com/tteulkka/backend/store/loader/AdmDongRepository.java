package com.tteulkka.backend.store.loader;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AdmDongRepository extends JpaRepository<AdmDong, String> {

    Optional<AdmDong> findFirstByStatusOrderByCodeAsc(LoadStatus status);

    List<AdmDong> findAllByStatus(LoadStatus status);

    long countByStatus(LoadStatus status);
}
