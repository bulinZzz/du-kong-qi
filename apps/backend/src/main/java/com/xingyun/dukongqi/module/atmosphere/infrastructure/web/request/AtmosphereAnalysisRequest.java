package com.xingyun.dukongqi.module.atmosphere.infrastructure.web.request;

import jakarta.validation.constraints.NotBlank;

/**
 * 空气分析的 HTTP 入参：Bean Validation 注解止步于 Web 层，不向内传递。
 */
public record AtmosphereAnalysisRequest(
        @NotBlank(message = "text 不能为空")
        String text) {
}
