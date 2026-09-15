package com.tteulkka.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * IP당 분 단위 고정 윈도우 rate limit.
 * 단일 인스턴스 전제 — 스케일 아웃 시 Redis 기반으로 교체 필요.
 *
 * X-Forwarded-For는 신뢰된 프록시 CIDR 목록에서 온 요청에 한해서만 파싱한다.
 * 신뢰되지 않은 요청은 TCP RemoteAddr를 IP로 사용해 헤더 스푸핑을 차단한다.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    /**
     * 신뢰된 리버스 프록시 IP 목록.
     * 실제 배포 환경의 로드밸런서·프록시 IP를 여기에 추가한다.
     */
    private static final java.util.Set<String> TRUSTED_PROXIES = java.util.Set.of(
            "127.0.0.1", "::1"
    );

    private static final int MAX_REQUESTS_PER_MINUTE = 120;
    private static final long WINDOW_MILLIS = 60_000L;

    private record Window(long startMillis, AtomicInteger count) {}

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String clientIp = resolveClientIp(request);
        long now = System.currentTimeMillis();

        Window window = windows.compute(clientIp, (ip, existing) -> {
            if (existing == null || now - existing.startMillis() >= WINDOW_MILLIS) {
                return new Window(now, new AtomicInteger(0));
            }
            return existing;
        });

        if (window.count().incrementAndGet() > MAX_REQUESTS_PER_MINUTE) {
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"요청이 너무 많습니다. 잠시 후 다시 시도해주세요.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (TRUSTED_PROXIES.contains(remoteAddr)) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.split(",")[0].trim();
            }
        }
        return remoteAddr;
    }

    // 만료된 윈도우 정리 (메모리 누수 방지)
    @Scheduled(fixedRate = 5 * 60_000L)
    public void evictExpiredWindows() {
        long now = System.currentTimeMillis();
        windows.entrySet().removeIf(e -> now - e.getValue().startMillis() >= WINDOW_MILLIS);
    }
}
