package com.tteulkka.backend.store.loader;

import com.tteulkka.backend.store.Store;
import com.tteulkka.backend.store.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StorePersistenceService {

    private final StoreRepository storeRepository;

    @Transactional
    public int saveNewStores(List<Store> stores) {
        // 페이지 내 bizesId 중복 제거
        List<Store> deduplicated = stores.stream()
                .collect(Collectors.toMap(
                        Store::getBizesId,
                        s -> s,
                        (a, b) -> a,
                        LinkedHashMap::new
                ))
                .values().stream()
                .toList();

        Collection<String> bizesIds = deduplicated.stream()
                .map(Store::getBizesId)
                .toList();

        Set<String> existing = storeRepository.findExistingBizesIds(bizesIds);

        List<Store> newStores = deduplicated.stream()
                .filter(s -> !existing.contains(s.getBizesId()))
                .toList();

        if (!newStores.isEmpty()) {
            storeRepository.saveAll(newStores);
        }
        return newStores.size();
    }
}
