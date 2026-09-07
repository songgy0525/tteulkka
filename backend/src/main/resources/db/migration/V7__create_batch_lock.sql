CREATE TABLE batch_lock (
    job_name   VARCHAR(50) PRIMARY KEY,
    running    BOOLEAN     NOT NULL DEFAULT false,
    started_at TIMESTAMP
);

-- nationwide 적재 잡 초기 행
INSERT INTO batch_lock (job_name, running) VALUES ('nationwide', false);
