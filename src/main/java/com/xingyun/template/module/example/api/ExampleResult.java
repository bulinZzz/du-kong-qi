package com.xingyun.template.module.example.api;

import com.xingyun.template.module.example.domain.model.ExampleId;

/**
 * 示例聚合的出参契约。
 */
public record ExampleResult(ExampleId id, String code, String name) {
}
