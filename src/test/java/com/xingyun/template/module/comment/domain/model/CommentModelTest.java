package com.xingyun.template.module.comment.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * CommentModel 单元测试：覆盖聚合根的工厂、重建与跨模块引用持有。
 */
class CommentModelTest {

    @Nested
    @DisplayName("create：新建聚合")
    class Create {

        @Test
        @DisplayName("正常创建时无主键，exampleId 与 content 按入参持有")
        void create_should_have_no_id_and_hold_fields() {
            CommentModel model = CommentModel.create(1L, "评论内容");

            assertThat(model.getId()).isNull();
            assertThat(model.getExampleId()).isEqualTo(1L);
            assertThat(model.getContent()).isEqualTo("评论内容");
        }

        @Test
        @DisplayName("exampleId 为 null 时快速失败")
        void create_should_fail_fast_when_example_id_null() {
            assertThatThrownBy(() -> CommentModel.create(null, "评论内容"))
                    .isInstanceOf(NullPointerException.class)
                    .hasMessage("CommentModel.create 的 exampleId 不能为 null");
        }

        @Test
        @DisplayName("content 为 null 时快速失败")
        void create_should_fail_fast_when_content_null() {
            assertThatThrownBy(() -> CommentModel.create(1L, null))
                    .isInstanceOf(NullPointerException.class)
                    .hasMessage("CommentModel.create 的 content 不能为 null");
        }
    }

    @Nested
    @DisplayName("reconstitute：从持久化状态重建聚合")
    class Reconstitute {

        @Test
        @DisplayName("携带仓储回填的主键重建，字段按入参持有")
        void reconstitute_should_hold_id_and_fields() {
            CommentModel model = CommentModel.reconstitute(new CommentId(1L), 1L, "评论内容");

            assertThat(model.getId()).isEqualTo(new CommentId(1L));
            assertThat(model.getExampleId()).isEqualTo(1L);
            assertThat(model.getContent()).isEqualTo("评论内容");
        }

        @Test
        @DisplayName("id 为 null 时快速失败")
        void reconstitute_should_fail_fast_when_id_null() {
            assertThatThrownBy(() -> CommentModel.reconstitute(null, 1L, "评论内容"))
                    .isInstanceOf(NullPointerException.class)
                    .hasMessage("CommentModel.reconstitute 的 id 不能为 null");
        }
    }
}
