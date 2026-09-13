package com.xingyun.dukongqi.module.example.api;

import com.xingyun.dukongqi.module.example.domain.model.ExampleId;

/**
 * 示例聚合的出参契约。
 */
public record ExampleResult(ExampleId id, String code, String name) {
}
