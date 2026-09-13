package com.xingyun.template.module.comment.domain.repository;

import com.xingyun.template.module.comment.domain.model.CommentModel;

import java.util.List;

/**
 * 评论聚合根的仓储契约（纯 Java Interface，仅依赖领域模型）。
 */
public interface CommentRepository {

    /**
     * 保存评论，返回持久化后的领域模型（含回填的主键）。
     */
    CommentModel save(CommentModel commentModel);

    /**
     * 按引用的示例聚合标识列出评论，无命中时为空列表。
     */
    List<CommentModel> findByExampleId(Long exampleId);
}
