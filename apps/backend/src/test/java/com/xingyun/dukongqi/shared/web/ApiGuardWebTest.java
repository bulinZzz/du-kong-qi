package com.xingyun.dukongqi.shared.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.xingyun.dukongqi.module.atmosphere.application.port.AtmosphereAnalyzer;
import com.xingyun.dukongqi.module.atmosphere.domain.model.AtmosphereAnalysis;
import com.xingyun.dukongqi.module.atmosphere.domain.model.FlameIntensity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

/**
 * 对外防线在 HTTP 边界上的表现：拦得住、放得行，且拒绝时不把对方送来的来源回显出去。
 *
 * <p>判断逻辑本身由 {@link ApiGuardInterceptorTest} 覆盖，这里只验证它挂上了、翻译成了正确状态码。
 */
@SpringBootTest(properties = "api-guard.allowed-origins[0]=chrome-extension://abcdefghijklmnopabcdefghijklmnop")
class ApiGuardWebTest {

    private static final String EXTENSION_ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

    private static final String LONG_TEXT = "这里是一段足够长的页面文本。".repeat(30);

    private final WebApplicationContext context;

    private MockMvc mockMvc;

    @MockitoBean
    private AtmosphereAnalyzer atmosphereAnalyzer;

    @Autowired
    ApiGuardWebTest(WebApplicationContext context) {
        this.context = context;
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    @DisplayName("来源在名单内照常分析")
    void analyze_should_pass_for_the_allowed_origin() throws Exception {
        given(atmosphereAnalyzer.analyze(anyString()))
                .willReturn(new AtmosphereAnalysis(
                        new FlameIntensity(52),
                        "争论明显",
                        List.of("出现讽刺"),
                        0.8));

        mockMvc.perform(analysis().header(HttpHeaders.ORIGIN, EXTENSION_ORIGIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flameIntensity").value(52));
    }

    @Test
    @DisplayName("来源不在名单内返回 403，且不回显对方送来的来源")
    void analyze_should_return_403_for_another_origin() throws Exception {
        mockMvc.perform(analysis().header(HttpHeaders.ORIGIN, "https://example.com"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.title").value("Forbidden"))
                .andExpect(jsonPath("$.detail").value("请求来源不被允许"))
                .andExpect(result -> assertThat(result.getResponse().getContentAsString())
                        .doesNotContain("example.com"));
    }

    @Test
    @DisplayName("没有来源头返回 403")
    void analyze_should_return_403_without_origin() throws Exception {
        mockMvc.perform(analysis())
                .andExpect(status().isForbidden());
    }

    private static MockHttpServletRequestBuilder analysis() {
        return post("/atmosphere/analysis")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "text": "%s"
                        }
                        """.formatted(LONG_TEXT));
    }
}
