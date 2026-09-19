package com.xingyun.dukongqi.shared.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import com.xingyun.dukongqi.shared.exception.OriginNotAllowedException;
import com.xingyun.dukongqi.shared.exception.RequestQuotaExceededException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

/**
 * 对外防线的判断逻辑：来源、每分钟窗口与每日额度。
 *
 * <p>时钟按测试需要拨动，所以窗口过期与跨日归零都是确定性的，不必真的等。
 */
class ApiGuardInterceptorTest {

    private static final String EXTENSION_ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

    private final MutableClock clock = new MutableClock();

    /** 每分钟 3 次、每日 5 次，小而好数。 */
    private final ApiGuardInterceptor interceptor = new ApiGuardInterceptor(
            new ApiGuardProperties(List.of("/atmosphere/**"), List.of(EXTENSION_ORIGIN), 3, 5),
            clock);

    @Test
    @DisplayName("来源在名单内放行")
    void allows_the_allowed_origin() {
        assertThat(preHandle(request(EXTENSION_ORIGIN, "10.0.0.1"))).isTrue();
    }

    @Test
    @DisplayName("来源不在名单内拒绝")
    void rejects_another_origin() {
        assertThatThrownBy(() -> preHandle(request("https://example.com", "10.0.0.1")))
                .isInstanceOf(OriginNotAllowedException.class);
    }

    @Test
    @DisplayName("没有来源头也拒绝")
    void rejects_missing_origin() {
        assertThatThrownBy(() -> preHandle(request(null, "10.0.0.1")))
                .isInstanceOf(OriginNotAllowedException.class);
    }

    @Test
    @DisplayName("未配置允许来源时不校验来源")
    void allows_any_origin_when_no_origin_is_configured() {
        ApiGuardInterceptor open = new ApiGuardInterceptor(
                new ApiGuardProperties(List.of("/atmosphere/**"), List.of(), 3, 5),
                clock);

        assertThat(open.preHandle(request("https://example.com", "10.0.0.1"), response(), new Object()))
                .isTrue();
    }

    @Test
    @DisplayName("同一 IP 超过每分钟上限后拒绝")
    void rejects_after_the_per_ip_limit() {
        for (int i = 0; i < 3; i++) {
            preHandle(request(EXTENSION_ORIGIN, "10.0.0.1"));
        }

        assertThatThrownBy(() -> preHandle(request(EXTENSION_ORIGIN, "10.0.0.1")))
                .isInstanceOf(RequestQuotaExceededException.class)
                .hasFieldOrPropertyWithValue("reason", RequestQuotaExceededException.Reason.PER_IP);
    }

    @Test
    @DisplayName("窗口过去之后重新计数")
    void counts_again_after_the_window_passes() {
        for (int i = 0; i < 3; i++) {
            preHandle(request(EXTENSION_ORIGIN, "10.0.0.1"));
        }

        clock.advance(Duration.ofMinutes(1));

        assertThat(preHandle(request(EXTENSION_ORIGIN, "10.0.0.1"))).isTrue();
    }

    @Test
    @DisplayName("不同 IP 各算一份")
    void counts_each_ip_on_its_own() {
        for (int i = 0; i < 3; i++) {
            preHandle(request(EXTENSION_ORIGIN, "10.0.0.1"));
        }

        assertThat(preHandle(request(EXTENSION_ORIGIN, "10.0.0.2"))).isTrue();
    }

    @Test
    @DisplayName("当日额度用完后拒绝，跨日归零")
    void rejects_when_the_daily_budget_is_used_up_and_resets_the_next_day() {
        for (int i = 0; i < 5; i++) {
            preHandle(request(EXTENSION_ORIGIN, "10.0.0." + i));
        }

        assertThatThrownBy(() -> preHandle(request(EXTENSION_ORIGIN, "10.0.0.99")))
                .isInstanceOf(RequestQuotaExceededException.class)
                .hasFieldOrPropertyWithValue("reason", RequestQuotaExceededException.Reason.DAILY);

        clock.advance(Duration.ofDays(1));

        assertThat(preHandle(request(EXTENSION_ORIGIN, "10.0.0.99"))).isTrue();
    }

    private boolean preHandle(HttpServletRequest request) {
        return interceptor.preHandle(request, response(), new Object());
    }

    private static HttpServletRequest request(String origin, String remoteAddr) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        given(request.getHeader(HttpHeaders.ORIGIN)).willReturn(origin);
        given(request.getRemoteAddr()).willReturn(remoteAddr);
        return request;
    }

    private static HttpServletResponse response() {
        return mock(HttpServletResponse.class);
    }

    /** 可以拨动的时钟。 */
    private static final class MutableClock extends Clock {

        private Instant now = Instant.parse("2026-01-01T00:00:00Z");

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }
    }
}
