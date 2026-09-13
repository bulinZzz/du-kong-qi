package com.xingyun.template.module.example.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.xingyun.template.shared.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * ExampleModel 单元测试：覆盖聚合根的充血行为与不变量（工厂、重建、重命名）。
 */
class ExampleModelTest {

    @Nested
    @DisplayName("create：新建聚合")
    class Create {

        @Test
        @DisplayName("正常创建时无主键，code 与 name 按入参持有")
        void create_should_have_no_id_and_hold_fields() {
            ExampleModel model = ExampleModel.create("E001", "示例");

            assertThat(model.getId()).isNull();
            assertThat(model.getCode()).isEqualTo("E001");
            assertThat(model.getName()).isEqualTo("示例");
        }

        @Test
        @DisplayName("code 为 null 时快速失败")
        void create_should_fail_fast_when_code_null() {
            assertThatThrownBy(() -> ExampleModel.create(null, "示例"))
                    .isInstanceOf(NullPointerException.class)
                    .hasMessage("ExampleModel.create 的 code 不能为 null");
        }

        @Test
        @DisplayName("name 为 null 时快速失败")
        void create_should_fail_fast_when_name_null() {
            assertThatThrownBy(() -> ExampleModel.create("E001", null))
                    .isInstanceOf(NullPointerException.class)
                    .hasMessage("ExampleModel.create 的 name 不能为 null");
        }
    }

    @Nested
    @DisplayName("reconstitute：从持久化状态重建聚合")
    class Reconstitute {

        @Test
        @DisplayName("携带仓储回填的主键重建，字段按入参持有")
        void reconstitute_should_hold_id_and_fields() {
            ExampleModel model = ExampleModel.reconstitute(new ExampleId(1L), "E001", "示例");

            assertThat(model.getId()).isEqualTo(new ExampleId(1L));
            assertThat(model.getCode()).isEqualTo("E001");
            assertThat(model.getName()).isEqualTo("示例");
        }

        @Test
        @DisplayName("id 为 null 时快速失败")
        void reconstitute_should_fail_fast_when_id_null() {
            assertThatThrownBy(() -> ExampleModel.reconstitute(null, "E001", "示例"))
                    .isInstanceOf(NullPointerException.class)
                    .hasMessage("ExampleModel.reconstitute 的 id 不能为 null");
        }
    }

    @Nested
    @DisplayName("rename：重命名")
    class Rename {

        @Test
        @DisplayName("新名称生效")
        void rename_should_update_name() {
            ExampleModel model = ExampleModel.reconstitute(new ExampleId(1L), "E001", "旧名称");

            model.rename("新名称");

            assertThat(model.getName()).isEqualTo("新名称");
        }

        @Test
        @DisplayName("新名称与当前名称相同时拒绝（聚合不变量）")
        void rename_should_reject_same_name() {
            ExampleModel model = ExampleModel.reconstitute(new ExampleId(1L), "E001", "同名");

            assertThatThrownBy(() -> model.rename("同名"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessage("新名称与当前名称相同");
        }

        @Test
        @DisplayName("新名称为 null 时快速失败，聚合名称保持不变")
        void rename_should_fail_fast_when_new_name_null() {
            ExampleModel model = ExampleModel.reconstitute(new ExampleId(1L), "E001", "旧名称");

            assertThatThrownBy(() -> model.rename(null))
                    .isInstanceOf(NullPointerException.class)
                    .hasMessage("ExampleModel.rename 的 newName 不能为 null");
            assertThat(model.getName()).isEqualTo("旧名称");
        }
    }
}
