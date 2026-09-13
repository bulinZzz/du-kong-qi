package com.xingyun.template.module.comment.infrastructure.persistence.converter;

import com.xingyun.template.module.comment.domain.model.CommentId;
import com.xingyun.template.module.comment.domain.model.CommentModel;
import com.xingyun.template.module.comment.infrastructure.persistence.entity.CommentPO;
import org.springframework.stereotype.Component;

/**
 * CommentPO ↔ CommentModel 双向转换器：标识值在此完成 Long ↔ CommentId 互转。
 */
@Component
public class CommentConverter {

    /**
     * PO 转领域模型：要求 PO 已携带主键（insert 回填后调用）。
     */
    public CommentModel toDomain(CommentPO po) {
        return CommentModel.reconstitute(new CommentId(po.getId()), po.getExampleId(), po.getContent());
    }

    /**
     * 领域模型转 PO：新聚合的空标识映射为 null 主键，交给数据库自增。
     */
    public CommentPO toPO(CommentModel model) {
        CommentPO po = new CommentPO();
        po.setId(model.getId() == null ? null : model.getId().value());
        po.setExampleId(model.getExampleId());
        po.setContent(model.getContent());
        return po;
    }
}
