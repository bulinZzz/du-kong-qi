package com.xingyun.template.shared.web;

import com.xingyun.template.shared.exception.BusinessException;
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
     * 业务规则拒绝 → 409 Conflict。
     */
    @ExceptionHandler(BusinessException.class)
    ProblemDetail onBusinessException(BusinessException exception) {
        log.warn("业务规则拒绝：{}", exception.getMessage());

        ProblemDetail problemDetail =
                ProblemDetail.forStatusAndDetail(
                        HttpStatus.CONFLICT,
                        exception.getMessage()
                );
        problemDetail.setTitle("Business Rule Violation");
        return problemDetail;
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
