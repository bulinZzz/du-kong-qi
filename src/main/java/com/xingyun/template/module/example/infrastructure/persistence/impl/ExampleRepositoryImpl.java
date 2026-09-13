package com.xingyun.template.module.example.infrastructure.persistence.impl;

import com.xingyun.template.module.example.domain.model.ExampleId;
import com.xingyun.template.module.example.domain.model.ExampleModel;
import com.xingyun.template.module.example.domain.repository.ExampleRepository;
import com.xingyun.template.module.example.infrastructure.persistence.converter.ExampleConverter;
import com.xingyun.template.module.example.infrastructure.persistence.entity.ExamplePO;
import com.xingyun.template.module.example.infrastructure.persistence.mapper.ExampleMapper;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 仓储契约的基础设施实现：经 Converter 完成 PO 与领域模型互转后，委托 Mapper 持久化。
 */
@Repository
public class ExampleRepositoryImpl implements ExampleRepository {

    private final ExampleMapper exampleMapper;
    private final ExampleConverter exampleConverter;

    public ExampleRepositoryImpl(ExampleMapper exampleMapper, ExampleConverter exampleConverter) {
        this.exampleMapper = exampleMapper;
        this.exampleConverter = exampleConverter;
    }

    @Override
    public Optional<ExampleModel> findById(ExampleId id) {
        ExamplePO po = exampleMapper.selectById(id.value());
        // 未命中直接返回 empty：Converter 契约要求 PO 非空，判空责任在仓储
        return po == null ? Optional.empty() : Optional.of(exampleConverter.toDomain(po));
    }

    @Override
    public ExampleModel save(ExampleModel exampleModel) {
        ExamplePO po = exampleConverter.toPO(exampleModel);
        if (po.getId() == null) {
            exampleMapper.insert(po);   // insert 后 PO 获得数据库回填的主键
        } else {
            exampleMapper.updateById(po);
        }
        return exampleConverter.toDomain(po);
    }
}
