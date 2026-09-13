package com.xingyun.dukongqi.module.atmosphere.infrastructure.web;

import com.xingyun.dukongqi.module.atmosphere.api.AnalysisUnavailableException;
import com.xingyun.dukongqi.module.atmosphere.api.InsufficientContentException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 本模块失败语义 → HTTP 的翻译器。
 *
 * <p>模块自己的失败语义由模块自己翻译，不依赖 shared 的通用翻译器；声明最高优先级，
 * 确保先于通用翻译器的兜底处理被匹配。
 */
@Slf4j
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AtmosphereExceptionHandler {

    /**
     * 内容不足以支撑分析 → 422 Unprocessable Content。
     *
     * <p>请求本身合法，问题在于内容无法形成判断，因此不建议原样重试。
     */
    @ExceptionHandler(InsufficientContentException.class)
    ProblemDetail onInsufficientContentException(InsufficientContentException exception) {
        log.warn("内容不足以分析：{}", exception.getMessage());

        ProblemDetail problemDetail =
                ProblemDetail.forStatusAndDetail(
                        HttpStatus.UNPROCESSABLE_CONTENT,
                        exception.getMessage()
                );
        problemDetail.setTitle("Insufficient Content");
        return problemDetail;
    }

    /**
     * 分析能力暂时不可用 → 503 Service Unavailable。
     *
     * <p>失败原因写入日志；响应只给出可重试的提示，不暴露外部依赖细节。
     */
    @ExceptionHandler(AnalysisUnavailableException.class)
    ProblemDetail onAnalysisUnavailableException(AnalysisUnavailableException exception) {
        log.error("空气分析暂时不可用", exception);

        ProblemDetail problemDetail =
                ProblemDetail.forStatusAndDetail(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "空气分析暂时不可用，请稍后再试"
                );
        problemDetail.setTitle("Analysis Unavailable");
        return problemDetail;
    }
}
