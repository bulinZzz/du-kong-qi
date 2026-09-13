package com.xingyun.template.module.comment.infrastructure.persistence.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

/**
 * t_comment 表的物理表 PO，仅存在于基础设施持久化层，禁止外泄。
 *
 * <p>PO 是供 ORM 框架填充的贫血数据载体，{@code @Getter}/{@code @Setter} 在此可接受；
 * 业务行为与状态约束属于领域模型，不进入 PO。
 */
@Getter
@Setter
@TableName("t_comment")
public class CommentPO {

    // 主键由数据库自增生成，insert 后由框架回填
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long exampleId;
    private String content;
}
