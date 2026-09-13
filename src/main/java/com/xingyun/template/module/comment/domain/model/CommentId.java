package com.xingyun.template.module.comment.domain.model;

import java.util.Objects;

/**
 * 评论聚合的强类型标识：以专属类型隔离不同实体的裸值，杜绝标识混传。
 */
public record CommentId(Long value) {

    public CommentId {
        Objects.requireNonNull(value, "标识值不能为 null");
    }
}
