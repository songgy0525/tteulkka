package com.tteulkka.backend.store.loader;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdmDongSeeder implements ApplicationRunner {

    private static final String UPSERT_SQL =
            "INSERT INTO adm_dong (code, sido, sigungu, dong, status) " +
            "VALUES (?, ?, ?, ?, 'PENDING') ON CONFLICT (code) DO NOTHING";

    private final AdmDongRepository admDongRepository;
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        // 앱 재시작 시 이전 크래시로 LOADING 상태에 멈춘 행정동 복구 (항상 실행)
        int reset = admDongRepository.resetLoadingToPending();
        if (reset > 0) {
            log.info("이전 실행에서 중단된 LOADING 행정동 {}개를 PENDING으로 복구", reset);
        }

        if (admDongRepository.count() > 0) {
            return; // 이미 시딩됨
        }

        // 최초 시작: ON CONFLICT DO NOTHING으로 멱등 시딩 (다중 인스턴스 안전)
        log.info("adm_dong 시딩 시작");
        ClassPathResource resource = new ClassPathResource("db/seed/adm_dong.csv");
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {

            List<String[]> rows = reader.lines()
                    .skip(1) // header
                    .map(line -> line.split(",", 4))
                    .toList();

            jdbcTemplate.batchUpdate(UPSERT_SQL, rows, 500, (ps, row) -> {
                ps.setString(1, row[0]);
                ps.setString(2, row[1]);
                ps.setString(3, row[2]);
                ps.setString(4, row[3]);
            });
            log.info("adm_dong 시딩 완료: {}개", rows.size());

        } catch (Exception e) {
            log.error("adm_dong 시딩 실패", e);
            throw new RuntimeException("adm_dong 시딩 실패", e);
        }
    }
}
