package com.xingyun.dukongqi.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.xingyun.dukongqi.shared.exception.OriginNotAllowedException;
import com.xingyun.dukongqi.shared.exception.RequestQuotaExceededException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void unexpected_exception_should_return_500_without_internal_detail() {
        ProblemDetail problemDetail =
                handler.onUnexpectedException(
                        new IllegalStateException("database password=secret")
                );

        assertThat(problemDetail.getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR.value());
        assertThat(problemDetail.getTitle()).isEqualTo("Internal Server Error");
        assertThat(problemDetail.getDetail()).isEqualTo("服务器内部错误");
    }

    @Test
    void origin_not_allowed_should_return_403_without_echoing_the_origin() {
        ProblemDetail problemDetail =
                handler.onOriginNotAllowed(new OriginNotAllowedException("https://example.com"));

        assertThat(problemDetail.getStatus()).isEqualTo(HttpStatus.FORBIDDEN.value());
        assertThat(problemDetail.getTitle()).isEqualTo("Forbidden");
        assertThat(problemDetail.getDetail())
                .isEqualTo("请求来源不被允许")
                .doesNotContain("example.com");
    }

    @Test
    void per_ip_quota_should_return_429_and_point_at_retrying_later() {
        ProblemDetail problemDetail = handler.onRequestQuotaExceeded(
                new RequestQuotaExceededException(RequestQuotaExceededException.Reason.PER_IP));

        assertThat(problemDetail.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
        assertThat(problemDetail.getTitle()).isEqualTo("Too Many Requests");
        assertThat(problemDetail.getDetail()).isEqualTo("请求过于频繁，请稍后再试");
    }

    @Test
    void daily_quota_should_return_429_and_point_at_tomorrow() {
        ProblemDetail problemDetail = handler.onRequestQuotaExceeded(
                new RequestQuotaExceededException(RequestQuotaExceededException.Reason.DAILY));

        assertThat(problemDetail.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
        assertThat(problemDetail.getDetail()).isEqualTo("今日额度已用完，请明天再试");
    }
}
