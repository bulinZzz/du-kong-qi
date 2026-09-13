package com.xingyun.template.shared.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * 未预期异常的完整 HTTP 链路回归：Controller 抛出技术异常 → Spring MVC 分发
 * → {@code GlobalExceptionHandler} 兜底 → 500 ProblemDetail。
 *
 * <p>与 {@link GlobalExceptionHandlerTest} 中直接调用处理器的单元测试不同，
 * 本测试证明 Spring MVC 的异常分发确实将技术异常路由到兜底处理器而非业务异常处理器，
 * 且内部异常信息不出现在响应体中。
 */
@SpringBootTest
class UnexpectedExceptionWebTest {

    private final WebApplicationContext context;

    private MockMvc mockMvc;

    @Autowired
    UnexpectedExceptionWebTest(WebApplicationContext context) {
        this.context = context;
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    @DisplayName("未预期异常经 HTTP 链路返回 500 ProblemDetail，且不泄漏内部信息")
    void unexpected_exception_should_return_500_problem_detail() throws Exception {
        mockMvc.perform(get("/test/unexpected-exception"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.title").value("Internal Server Error"))
                .andExpect(jsonPath("$.detail").value("服务器内部错误"))
                .andExpect(result ->
                        assertThat(result.getResponse().getContentAsString())
                                .doesNotContain("internal-secret"));
    }
}
