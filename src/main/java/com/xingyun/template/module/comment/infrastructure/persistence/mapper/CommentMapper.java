package com.xingyun.template.module.comment.infrastructure.persistence.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.xingyun.template.module.comment.infrastructure.persistence.entity.CommentPO;
import org.apache.ibatis.annotations.Mapper;

/**
 * t_comment 表的 Mapper：继承 BaseMapper 获得通用 CRUD，不写 SQL。
 */
@Mapper
public interface CommentMapper extends BaseMapper<CommentPO> {
}
