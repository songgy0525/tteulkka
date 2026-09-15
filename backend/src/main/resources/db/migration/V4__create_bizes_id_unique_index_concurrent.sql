-- NOTE: CONCURRENTLY는 Flyway의 내부 트랜잭션(advisory lock)과 deadlock을 일으킴.
-- Flyway 마이그레이션 컨텍스트에서는 CONCURRENTLY 사용 불가.
--
-- [운영 DB 적용 시 주의]
-- 이전에 CONCURRENTLY 버전의 V4를 적용한 DB는 checksum 불일치로 Flyway 검증이 실패한다.
-- 배포 전 아래 명령으로 checksum을 갱신해야 한다:
--   ./mvnw flyway:repair -Dflyway.url=<jdbc-url> -Dflyway.user=<user> -Dflyway.password=<pw>
DROP INDEX IF EXISTS idx_store_bizes_id;
CREATE UNIQUE INDEX idx_store_bizes_id ON store (bizes_id);
