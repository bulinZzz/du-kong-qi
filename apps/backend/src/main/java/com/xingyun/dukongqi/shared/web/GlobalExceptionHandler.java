package com.xingyun.dukongqi.shared.web;

import com.xingyun.dukongqi.shared.exception.OriginNotAllowedException;
import com.xingyun.dukongqi.shared.exception.RequestQuotaExceededException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * 全局异常 → HTTP 翻译器。
 *
 * <p>业务代码不捕获技术异常；异常传播到 HTTP 边界后统一翻译。
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    /**
     * 请求来源不被允许 → 403 Forbidden。
     *
     * <p>不回显对方送来的来源，免得把外部输入原样弹回去；来源写在日志里。
     */
    @ExceptionHandler(OriginNotAllowedException.class)
    ProblemDetail onOriginNotAllowed(OriginNotAllowedException exception) {
        log.warn("拒绝来源不被允许的请求", exception);

        ProblemDetail problemDetail =
                ProblemDetail.forStatusAndDetail(
                        HttpStatus.FORBIDDEN,
                        "请求来源不被允许"
                );
        problemDetail.setTitle("Forbidden");
        return problemDetail;
    }

    /**
     * 超出配额 → 429 Too Many Requests。
     *
     * <p>文案留在这里而不是跟着异常走：两种情况的区别是要告诉用户的东西，属于响应边界的事。
     */
    @ExceptionHandler(RequestQuotaExceededException.class)
    ProblemDetail onRequestQuotaExceeded(RequestQuotaExceededException exception) {
        log.warn("请求超出配额：{}", exception.reason());

        ProblemDetail problemDetail =
                ProblemDetail.forStatusAndDetail(
                        HttpStatus.TOO_MANY_REQUESTS,
                        quotaDetail(exception.reason())
                );
        problemDetail.setTitle("Too Many Requests");
        return problemDetail;
    }

    private static String quotaDetail(RequestQuotaExceededException.Reason reason) {
        return switch (reason) {
            case PER_IP -> "请求过于频繁，请稍后再试";
            case DAILY -> "今日额度已用完，请明天再试";
        };
    }

    /**
     * 未预期异常 → 500 Internal Server Error。
     *
     * <p>完整异常写日志，但不将内部异常信息暴露给调用方。
     */
    @ExceptionHandler(Exception.class)
    ProblemDetail onUnexpectedException(Exception exception) {
        log.error("未预期异常", exception);

        ProblemDetail problemDetail =
                ProblemDetail.forStatusAndDetail(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "服务器内部错误"
                );
        problemDetail.setTitle("Internal Server Error");
        return problemDetail;
    }
}
