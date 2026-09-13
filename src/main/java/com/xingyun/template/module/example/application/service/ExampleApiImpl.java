package com.xingyun.template.module.example.application.service;

import com.xingyun.template.module.example.api.ExampleApi;
import com.xingyun.template.module.example.api.ExampleCreateCommand;
import com.xingyun.template.module.example.api.ExampleRenameCommand;
import com.xingyun.template.module.example.api.ExampleResult;
import com.xingyun.template.module.example.domain.model.ExampleId;
import com.xingyun.template.module.example.domain.model.ExampleModel;
import com.xingyun.template.module.example.domain.repository.ExampleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * ExampleApi 的应用服务实现：编排用例流程，内聚契约 DTO ↔ 领域模型转换。
 */
@Service
public class ExampleApiImpl implements ExampleApi {

    private final ExampleRepository exampleRepository;

    public ExampleApiImpl(ExampleRepository exampleRepository) {
        this.exampleRepository = exampleRepository;
    }

    @Override
    public Optional<ExampleResult> findById(ExampleId id) {
        return exampleRepository.findById(id).map(ExampleApiImpl::toResult);
    }

    @Override
    public ExampleResult create(ExampleCreateCommand command) {
        ExampleModel model = ExampleModel.create(command.code(), command.name());
        return toResult(exampleRepository.save(model));
    }

    @Override
    @Transactional
    public boolean rename(ExampleRenameCommand command) {
        Optional<ExampleModel> found = exampleRepository.findById(command.id());
        found.ifPresent(model -> {
            model.rename(command.newName());
            exampleRepository.save(model);
        });
        return found.isPresent();
    }

    private static ExampleResult toResult(ExampleModel model) {
        return new ExampleResult(model.getId(), model.getCode(), model.getName());
    }
}
