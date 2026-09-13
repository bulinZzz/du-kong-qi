package com.xingyun.template.module.example.infrastructure.web.response;

/**
 * 示例聚合的 HTTP 出参：字段以裸值表达，领域类型不越过 HTTP 边界。
 */
public record ExampleResponse(Long id, String code, String name) {
}
