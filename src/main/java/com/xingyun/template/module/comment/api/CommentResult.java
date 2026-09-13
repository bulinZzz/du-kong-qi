package com.xingyun.template.module.comment.api;

import com.xingyun.template.module.comment.domain.model.CommentId;

/**
 * 评论聚合的出参契约。
 */
public record CommentResult(CommentId id, Long exampleId, String content) {
}
