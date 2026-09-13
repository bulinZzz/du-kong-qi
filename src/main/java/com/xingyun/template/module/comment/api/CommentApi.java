package com.xingyun.template.module.comment.api;

import java.util.List;
import java.util.Optional;

/**
 * 评论模块对外契约：本模块全部对外能力的唯一视图（跨模块调用仅可依赖本包）。
 *
 * <p>单契约模式：本接口即应用服务接口，{@code @Service} 实现类位于
 * {@code application/service}，契约 DTO 与领域模型的转换内聚在实现类中。
 */
public interface CommentApi {

    /**
     * 创建评论并挂载到指定示例聚合，创建前经对方 api 契约校验引用存在。
     *
     * <p>{@code exampleId} / {@code content} 不得为 {@code null}（编程契约，快速失败）；
     * {@code exampleId} 指向的示例聚合不存在属预期缺失，返回 {@code empty}。</p>
     *
     * @param command 创建入参
     * @return 携带主键的出参契约；引用的示例聚合不存在时返回 {@code empty}
     */
    Optional<CommentResult> create(CommentCreateCommand command);

    /**
     * 按查询条件列出评论。
     *
     * @param query 查询条件
     * @return 命中的评论列表，无命中时为空列表
     */
    List<CommentResult> listByExample(CommentQuery query);
}
