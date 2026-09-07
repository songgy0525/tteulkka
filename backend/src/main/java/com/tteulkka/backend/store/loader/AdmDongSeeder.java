package com.tteulkka.backend.store.loader;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdmDongSeeder implements ApplicationRunner {

    private final AdmDongRepository admDongRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (admDongRepository.count() > 0) {
            return;
        }

        log.info("adm_dong 시딩 시작");
        ClassPathResource resource = new ClassPathResource("db/seed/adm_dong.csv");
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {

            List<AdmDong> list = reader.lines()
                    .skip(1) // header(code,sido,sigungu,dong)
                    .map(line -> {
                        String[] parts = line.split(",", 4);
                        return AdmDong.of(parts[0], parts[1], parts[2], parts[3]);
                    })
                    .toList();

            admDongRepository.saveAll(list);
            log.info("adm_dong 시딩 완료: {}개", list.size());

        } catch (Exception e) {
            log.error("adm_dong 시딩 실패", e);
            throw new RuntimeException("adm_dong 시딩 실패", e);
        }
    }
}
