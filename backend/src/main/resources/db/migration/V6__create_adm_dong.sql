CREATE TABLE adm_dong (
    code       VARCHAR(8)  PRIMARY KEY,
    sido       VARCHAR(50) NOT NULL,
    sigungu    VARCHAR(50) NOT NULL,
    dong       VARCHAR(50) NOT NULL,
    status     VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    store_count INT,
    loaded_at  TIMESTAMP
);

CREATE INDEX idx_adm_dong_status ON adm_dong (status);
