package com.xingyun.template.module.comment.domain.model;

import lombok.Getter;

import java.util.Objects;

/**
 * 评论聚合根：业务校验与状态变更内聚于此。
 *
 * <p>{@code exampleId} 以裸值持有对示例聚合的跨模块引用——对方模块的强类型标识
 * 不进入本模块领域，类型转换止于应用层。
 */
@Getter
public class CommentModel {

    private final CommentId id;
    private final Long exampleId;
    private final String content;

    private CommentModel(CommentId id, Long exampleId, String content) {
        this.id = id;
        this.exampleId = exampleId;
        this.content = content;
    }

    /**
     * 创建评论：新聚合不携带主键。
     */
    public static CommentModel create(Long exampleId, String content) {
        Objects.requireNonNull(exampleId, "CommentModel.create 的 exampleId 不能为 null");
        Objects.requireNonNull(content, "CommentModel.create 的 content 不能为 null");
        return new CommentModel(null, exampleId, content);
    }

    /**
     * 从持久化状态重建评论：要求携带已有主键。
     */
    public static CommentModel reconstitute(CommentId id, Long exampleId, String content) {
        Objects.requireNonNull(id, "CommentModel.reconstitute 的 id 不能为 null");
        Objects.requireNonNull(exampleId, "CommentModel.reconstitute 的 exampleId 不能为 null");
        Objects.requireNonNull(content, "CommentModel.reconstitute 的 content 不能为 null");
        return new CommentModel(id, exampleId, content);
    }
}
