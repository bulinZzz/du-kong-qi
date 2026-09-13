package com.xingyun.template.module.comment.api;

/**
 * 创建评论的入参契约：{@code exampleId} 以裸值引用示例聚合，
 * 不使本模块契约耦合对方模块的领域类型。
 */
public record CommentCreateCommand(Long exampleId, String content) {
}
