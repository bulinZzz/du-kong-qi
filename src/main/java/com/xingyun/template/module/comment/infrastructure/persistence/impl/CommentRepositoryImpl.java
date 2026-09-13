package com.xingyun.template.module.comment.infrastructure.persistence.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.xingyun.template.module.comment.domain.model.CommentModel;
import com.xingyun.template.module.comment.domain.repository.CommentRepository;
import com.xingyun.template.module.comment.infrastructure.persistence.converter.CommentConverter;
import com.xingyun.template.module.comment.infrastructure.persistence.entity.CommentPO;
import com.xingyun.template.module.comment.infrastructure.persistence.mapper.CommentMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 仓储契约的基础设施实现：经 Converter 完成 PO 与领域模型互转后，委托 Mapper 持久化。
 */
@Repository
public class CommentRepositoryImpl implements CommentRepository {

    private final CommentMapper commentMapper;
    private final CommentConverter commentConverter;

    public CommentRepositoryImpl(CommentMapper commentMapper, CommentConverter commentConverter) {
        this.commentMapper = commentMapper;
        this.commentConverter = commentConverter;
    }

    @Override
    public CommentModel save(CommentModel commentModel) {
        CommentPO po = commentConverter.toPO(commentModel);
        if (po.getId() == null) {
            commentMapper.insert(po);   // insert 后 PO 获得数据库回填的主键
        } else {
            commentMapper.updateById(po);
        }
        return commentConverter.toDomain(po);
    }

    @Override
    public List<CommentModel> findByExampleId(Long exampleId) {
        return commentMapper.selectList(
                        new LambdaQueryWrapper<CommentPO>().eq(CommentPO::getExampleId, exampleId))
                .stream()
                .map(commentConverter::toDomain)
                .toList();
    }
}
