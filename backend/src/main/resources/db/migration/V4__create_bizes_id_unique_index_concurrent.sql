-- NOTE: CONCURRENTLY는 Flyway의 내부 트랜잭션(advisory lock)과 deadlock을 일으킴.
-- Flyway 마이그레이션 컨텍스트에서는 CONCURRENTLY 사용 불가.
-- 운영 DB에 이미 V4가 적용된 경우 flyway repair로 checksum 갱신 필요.
DROP INDEX IF EXISTS idx_store_bizes_id;
CREATE UNIQUE INDEX idx_store_bizes_id ON store (bizes_id);
