package com.xingyun.template.module.comment.infrastructure.web;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.xingyun.template.module.comment.api.CommentApi;
import com.xingyun.template.module.comment.api.CommentCreateCommand;
import com.xingyun.template.module.example.api.ExampleApi;
import com.xingyun.template.module.example.api.ExampleCreateCommand;
import com.xingyun.template.module.example.domain.model.ExampleId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Comment 模块 HTTP 契约验证：覆盖创建评论与按示例查询评论的主要响应路径。
 */
@SpringBootTest
class CommentWebTest {

    private final WebApplicationContext context;
    private final ExampleApi exampleApi;
    private final CommentApi commentApi;

    private MockMvc mockMvc;
    private ExampleId existingExampleId;

    @Autowired
    CommentWebTest(
            WebApplicationContext context,
            ExampleApi exampleApi,
            CommentApi commentApi) {
        this.context = context;
        this.exampleApi = exampleApi;
        this.commentApi = commentApi;
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();

        existingExampleId = exampleApi.create(
                new ExampleCreateCommand("COMMENT-WEB-TEST", "示例")
        ).id();
    }

    @Test
    void create_should_return_201_with_location_and_body() throws Exception {
        mockMvc.perform(post("/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "exampleId": %d,
                                  "content": "测试评论"
                                }
                                """.formatted(existingExampleId.value())))
                .andExpect(status().isCreated())
                .andExpect(header().string(
                        "Location",
                        org.hamcrest.Matchers.matchesRegex("/comments/\\d+")
                ))
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.exampleId").value(existingExampleId.value()))
                .andExpect(jsonPath("$.content").value("测试评论"));
    }

    @Test
    void create_should_return_404_when_example_does_not_exist() throws Exception {
        mockMvc.perform(post("/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "exampleId": %d,
                                  "content": "测试评论"
                                }
                                """.formatted(Long.MAX_VALUE)))
                .andExpect(status().isNotFound());
    }

    @Test
    void create_should_return_400_when_request_is_invalid() throws Exception {
        mockMvc.perform(post("/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "exampleId": null,
                                  "content": ""
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void list_by_example_should_return_comments() throws Exception {
        commentApi.create(
                new CommentCreateCommand(
                        existingExampleId.value(),
                        "第一条评论"
                )
        );
        commentApi.create(
                new CommentCreateCommand(
                        existingExampleId.value(),
                        "第二条评论"
                )
        );

        mockMvc.perform(get("/comments")
                        .param("exampleId", String.valueOf(existingExampleId.value())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].exampleId").value(existingExampleId.value()))
                .andExpect(jsonPath("$[0].content").value("第一条评论"))
                .andExpect(jsonPath("$[1].exampleId").value(existingExampleId.value()))
                .andExpect(jsonPath("$[1].content").value("第二条评论"));
    }

    @Test
    void list_by_example_should_return_empty_list_when_no_comments_exist() throws Exception {
        mockMvc.perform(get("/comments")
                        .param("exampleId", String.valueOf(existingExampleId.value())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }
}
