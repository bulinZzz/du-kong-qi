package com.xingyun.template.module.example.infrastructure.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
 * Example 模块 HTTP 契约验证：覆盖创建、查询、重命名的主要响应路径。
 */
@SpringBootTest
class ExampleWebTest {

    private final WebApplicationContext context;
    private final ExampleApi exampleApi;

    private MockMvc mockMvc;
    private ExampleId existingId;

    @Autowired
    ExampleWebTest(WebApplicationContext context, ExampleApi exampleApi) {
        this.context = context;
        this.exampleApi = exampleApi;
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        existingId = exampleApi.create(
                new ExampleCreateCommand("WEB-TEST", "旧名称")
        ).id();
    }

    @Test
    void create_should_return_201_with_location_and_body() throws Exception {
        mockMvc.perform(post("/examples")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "code": "CREATE-TEST",
                                  "name": "新示例"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", org.hamcrest.Matchers.startsWith("/examples/")))
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.code").value("CREATE-TEST"))
                .andExpect(jsonPath("$.name").value("新示例"));
    }

    @Test
    void create_should_return_400_when_request_is_invalid() throws Exception {
        mockMvc.perform(post("/examples")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "code": "",
                                  "name": ""
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void find_by_id_should_return_200_when_example_exists() throws Exception {
        mockMvc.perform(get("/examples/{id}", existingId.value()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(existingId.value()))
                .andExpect(jsonPath("$.code").value("WEB-TEST"))
                .andExpect(jsonPath("$.name").value("旧名称"));
    }

    @Test
    void find_by_id_should_return_404_when_example_does_not_exist() throws Exception {
        mockMvc.perform(get("/examples/{id}", Long.MAX_VALUE))
                .andExpect(status().isNotFound());
    }

    @Test
    void rename_should_return_204_when_renamed_successfully() throws Exception {
        mockMvc.perform(put("/examples/{id}", existingId.value())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "新名称"
                                }
                                """))
                .andExpect(status().isNoContent());
    }

    @Test
    void rename_should_return_404_when_example_does_not_exist() throws Exception {
        mockMvc.perform(put("/examples/{id}", Long.MAX_VALUE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "新名称"
                                }
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void rename_should_return_problem_detail_409_when_name_is_unchanged() throws Exception {
        mockMvc.perform(put("/examples/{id}", existingId.value())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "旧名称"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.title").value("Business Rule Violation"))
                .andExpect(jsonPath("$.detail").value("新名称与当前名称相同"));
    }

    @Test
    void rename_should_return_400_when_request_is_invalid() throws Exception {
        mockMvc.perform(put("/examples/{id}", existingId.value())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": ""
                                }
                                """))
                .andExpect(status().isBadRequest());
    }
}
