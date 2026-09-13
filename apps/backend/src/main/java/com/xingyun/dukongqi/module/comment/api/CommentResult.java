package com.xingyun.dukongqi.module.comment.api;

import com.xingyun.dukongqi.module.comment.domain.model.CommentId;

/**
 * 评论聚合的出参契约。
 */
public record CommentResult(CommentId id, Long exampleId, String content) {
}
