package com.xingyun.template.module.example.domain.repository;

import com.xingyun.template.module.example.domain.model.ExampleId;
import com.xingyun.template.module.example.domain.model.ExampleModel;

import java.util.Optional;

/**
 * 示例聚合根的仓储契约（纯 Java Interface，仅依赖领域模型）。
 */
public interface ExampleRepository {

    /**
     * 按标识查询聚合根，不存在时返回 {@code empty}。
     */
    Optional<ExampleModel> findById(ExampleId id);

    /**
     * 保存聚合根，返回持久化后的领域模型（含回填的主键）。
     */
    ExampleModel save(ExampleModel exampleModel);
}
