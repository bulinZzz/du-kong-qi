package com.xingyun.template.module.example.domain.model;

import com.xingyun.template.shared.exception.BusinessException;
import lombok.Getter;

import java.util.Objects;

/**
 * 示例聚合根：业务校验与状态变更内聚于此。
 */
@Getter
public class ExampleModel {

    private final ExampleId id;
    private final String code;
    private String name;

    private ExampleModel(ExampleId id, String code, String name) {
        this.id = id;
        this.code = code;
        this.name = name;
    }

    /**
     * 创建聚合根：新聚合不携带主键。
     */
    public static ExampleModel create(String code, String name) {
        Objects.requireNonNull(code, "ExampleModel.create 的 code 不能为 null");
        Objects.requireNonNull(name, "ExampleModel.create 的 name 不能为 null");
        return new ExampleModel(null, code, name);
    }

    /**
     * 从持久化状态重建聚合根，要求携带已有主键。
     */
    public static ExampleModel reconstitute(ExampleId id, String code, String name) {
        Objects.requireNonNull(id, "ExampleModel.reconstitute 的 id 不能为 null");
        Objects.requireNonNull(code, "ExampleModel.reconstitute 的 code 不能为 null");
        Objects.requireNonNull(name, "ExampleModel.reconstitute 的 name 不能为 null");
        return new ExampleModel(id, code, name);
    }

    /**
     * 重命名：同名拒绝（新名称不能为 null）。
     */
    public void rename(String newName) {
        Objects.requireNonNull(newName, "ExampleModel.rename 的 newName 不能为 null");
        if (name.equals(newName)) {
            throw new BusinessException("新名称与当前名称相同");
        }
        this.name = newName;
    }
}
