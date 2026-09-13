package com.xingyun.template.module.example.infrastructure.web.request;

import jakarta.validation.constraints.NotBlank;

/**
 * 创建示例聚合的 HTTP 入参：Bean Validation 注解止步于 Web 层，不向内传递。
 */
public record ExampleCreateRequest(
        @NotBlank(message = "code 不能为空")
        String code,
        @NotBlank(message = "name 不能为空")
        String name) {
}
