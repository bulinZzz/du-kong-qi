package com.xingyun.template.module.example.infrastructure.persistence.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.xingyun.template.module.example.infrastructure.persistence.entity.ExamplePO;
import org.apache.ibatis.annotations.Mapper;

/**
 * t_example 表的 Mapper：继承 BaseMapper 获得通用 CRUD，不写 SQL。
 */
@Mapper
public interface ExampleMapper extends BaseMapper<ExamplePO> {
}
