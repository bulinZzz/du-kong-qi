package com.xingyun.template.module.example.api;

import com.xingyun.template.module.example.domain.model.ExampleId;

import java.util.Optional;

/**
 * 示例模块对外契约：本模块全部对外能力的唯一视图。
 *
 * <p>单契约模式：本接口即应用服务接口，{@code @Service} 实现类位于
 * {@code application/service}，契约 DTO 与领域模型的转换内聚在实现类中。
 */
public interface ExampleApi {

    /**
     * 按标识查询示例聚合。
     *
     * @param id 聚合标识，不得为 {@code null}
     * @return 命中时返回出参契约；不存在时返回 {@code empty}
     */
    Optional<ExampleResult> findById(ExampleId id);

    /**
     * 创建并保存示例聚合。
     *
     * <p>{@code name} / {@code code} 不得为 {@code null}（编程契约，快速失败）。</p>
     *
     * @param command 创建入参
     * @return 携带主键的出参契约
     */
    ExampleResult create(ExampleCreateCommand command);

    /**
     * 重命名示例聚合。
     *
     * <p>{@code newName} 不得为 {@code null}（编程契约，快速失败）；新名称与当前名称相同
     * 属聚合不变量违规，抛出 {@code BusinessException}。</p>
     *
     * @param command 重命名入参
     * @return 聚合存在且重命名成功时返回 {@code true}；聚合不存在属预期缺失，返回 {@code false}
     */
    boolean rename(ExampleRenameCommand command);
}
