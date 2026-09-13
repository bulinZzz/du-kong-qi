package com.xingyun.template.module.example.infrastructure.web.request;

import jakarta.validation.constraints.NotBlank;

/**
 * 重命名示例聚合的 HTTP 入参：Bean Validation 注解止步于 Web 层，不向内传递。
 */
public record ExampleRenameRequest(
        @NotBlank(message = "name 不能为空")
        String name) {
}
