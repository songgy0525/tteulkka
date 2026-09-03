CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE store (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    category_code   VARCHAR(20)  NOT NULL,
    category_name   VARCHAR(100) NOT NULL,
    location    GEOMETRY(Point, 4326) NOT NULL,
    address     VARCHAR(300),
    sido        VARCHAR(50),
    sigungu     VARCHAR(50),
    dong        VARCHAR(50),
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_store_location ON store USING GIST(location);
CREATE INDEX idx_store_category   ON store(category_code);
