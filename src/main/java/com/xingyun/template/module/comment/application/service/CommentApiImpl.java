package com.xingyun.template.module.comment.application.service;

import com.xingyun.template.module.comment.api.CommentApi;
import com.xingyun.template.module.comment.api.CommentCreateCommand;
import com.xingyun.template.module.comment.api.CommentQuery;
import com.xingyun.template.module.comment.api.CommentResult;
import com.xingyun.template.module.comment.domain.model.CommentModel;
import com.xingyun.template.module.comment.domain.repository.CommentRepository;
import com.xingyun.template.module.example.api.ExampleApi;
import com.xingyun.template.module.example.domain.model.ExampleId;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * CommentApi 的应用服务实现：编排用例流程，内聚契约 DTO ↔ 领域模型转换。
 *
 * <p>跨模块仅依赖 {@code ExampleApi} 契约；{@code ExampleId} 是其契约签名引用的
 * 值语义类型，转换在本类完成后即止，不向模块内扩散。
 */
@Service
public class CommentApiImpl implements CommentApi {

    private final CommentRepository commentRepository;
    private final ExampleApi exampleApi;

    public CommentApiImpl(CommentRepository commentRepository, ExampleApi exampleApi) {
        this.commentRepository = commentRepository;
        this.exampleApi = exampleApi;
    }

    @Override
    public Optional<CommentResult> create(CommentCreateCommand command) {
        // 引用存在性经对方 api 契约校验，不直查对方数据表
        boolean exampleExists = exampleApi.findById(new ExampleId(command.exampleId())).isPresent();
        if (!exampleExists) {
            return Optional.empty();
        }
        CommentModel model = CommentModel.create(command.exampleId(), command.content());
        return Optional.of(toResult(commentRepository.save(model)));
    }

    @Override
    public List<CommentResult> listByExample(CommentQuery query) {
        return commentRepository.findByExampleId(query.exampleId()).stream()
                .map(CommentApiImpl::toResult)
                .toList();
    }

    private static CommentResult toResult(CommentModel model) {
        return new CommentResult(model.getId(), model.getExampleId(), model.getContent());
    }
}
