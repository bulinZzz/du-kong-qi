package com.xingyun.template.module.example.infrastructure.persistence.converter;

import com.xingyun.template.module.example.domain.model.ExampleId;
import com.xingyun.template.module.example.domain.model.ExampleModel;
import com.xingyun.template.module.example.infrastructure.persistence.entity.ExamplePO;
import org.springframework.stereotype.Component;

/**
 * ExamplePO ↔ ExampleModel 双向转换器：标识值在此完成 Long ↔ ExampleId 互转。
 */
@Component
public class ExampleConverter {

    /**
     * PO 转领域模型：要求 PO 已携带主键（insert 回填后调用）。
     */
    public ExampleModel toDomain(ExamplePO po) {
        return ExampleModel.reconstitute(new ExampleId(po.getId()), po.getCode(), po.getName());
    }

    /**
     * 领域模型转 PO：新聚合的空标识映射为 null 主键，交给数据库自增。
     */
    public ExamplePO toPO(ExampleModel model) {
        ExamplePO po = new ExamplePO();
        po.setId(model.getId() == null ? null : model.getId().value());
        po.setCode(model.getCode());
        po.setName(model.getName());
        return po;
    }
}
