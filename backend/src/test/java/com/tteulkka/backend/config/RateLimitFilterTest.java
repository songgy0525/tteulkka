package com.tteulkka.backend.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {

    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter();
    }

    private MockHttpServletRequest apiRequest(String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/stores");
        request.setRemoteAddr(ip);
        return request;
    }

    @Test
    @DisplayName("한도 이내 요청은 정상 통과한다")
    void doFilter_underLimit_passes() throws Exception {
        // Arrange
        MockHttpServletRequest request = apiRequest("1.2.3.4");
        MockHttpServletResponse response = new MockHttpServletResponse();

        // Act
        filter.doFilter(request, response, new MockFilterChain());

        // Assert
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("분당 한도 초과 시 429를 반환한다")
    void doFilter_overLimit_returns429() throws Exception {
        // Arrange
        String ip = "5.6.7.8";
        for (int i = 0; i < 120; i++) {
            filter.doFilter(apiRequest(ip), new MockHttpServletResponse(), new MockFilterChain());
        }
        MockHttpServletResponse response = new MockHttpServletResponse();

        // Act
        filter.doFilter(apiRequest(ip), response, new MockFilterChain());

        // Assert
        assertThat(response.getStatus()).isEqualTo(429);
    }

    @Test
    @DisplayName("다른 IP는 독립적으로 카운트된다")
    void doFilter_differentIp_independentCount() throws Exception {
        // Arrange
        for (int i = 0; i < 121; i++) {
            filter.doFilter(apiRequest("9.9.9.9"), new MockHttpServletResponse(), new MockFilterChain());
        }
        MockHttpServletResponse response = new MockHttpServletResponse();

        // Act
        filter.doFilter(apiRequest("10.10.10.10"), response, new MockFilterChain());

        // Assert
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("api 외 경로는 필터를 적용하지 않는다")
    void shouldNotFilter_nonApiPath_returnsTrue() {
        // Arrange
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/health");

        // Act & Assert
        assertThat(filter.shouldNotFilter(request)).isTrue();
    }
}
