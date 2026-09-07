DROP INDEX CONCURRENTLY IF EXISTS idx_store_bizes_id;
CREATE UNIQUE INDEX CONCURRENTLY idx_store_bizes_id ON store (bizes_id);
