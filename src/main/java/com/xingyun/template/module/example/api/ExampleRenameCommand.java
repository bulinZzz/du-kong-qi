package com.xingyun.template.module.example.api;

import com.xingyun.template.module.example.domain.model.ExampleId;

/**
 * 重命名示例聚合的入参契约。
 */
public record ExampleRenameCommand(ExampleId id, String newName) {
}
