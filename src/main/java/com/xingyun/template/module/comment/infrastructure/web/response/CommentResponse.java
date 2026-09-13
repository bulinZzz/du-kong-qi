package com.xingyun.template.module.comment.infrastructure.web.response;

/**
 * 评论聚合的 HTTP 出参：字段以裸值表达，领域类型不越过 HTTP 边界。
 */
public record CommentResponse(Long id, Long exampleId, String content) {
}
