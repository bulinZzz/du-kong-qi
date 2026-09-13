package com.xingyun.template.module.comment.infrastructure.web.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 创建评论的 HTTP 入参：Bean Validation 注解止步于 Web 层，不向内传递。
 */
public record CommentCreateRequest(
        @NotNull(message = "exampleId 不能为空")
        Long exampleId,
        @NotBlank(message = "content 不能为空")
        String content) {
}
