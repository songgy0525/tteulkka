package com.tteulkka.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * 전국 데이터 적재 전용 단일 스레드 풀.
     * 동시에 하나의 적재 작업만 실행되도록 corePoolSize=1, maxPoolSize=1.
     */
    @Bean("nationwideLoader")
    public Executor nationwideLoaderExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(0);
        executor.setThreadNamePrefix("nationwide-loader-");
        executor.initialize();
        return executor;
    }
}
