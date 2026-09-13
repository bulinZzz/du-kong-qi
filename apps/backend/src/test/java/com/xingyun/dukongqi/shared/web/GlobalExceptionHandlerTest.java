package com.xingyun.dukongqi.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

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
}
