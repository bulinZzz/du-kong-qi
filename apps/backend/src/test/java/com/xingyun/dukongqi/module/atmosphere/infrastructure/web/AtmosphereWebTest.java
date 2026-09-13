package com.xingyun.dukongqi.module.atmosphere.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.xingyun.dukongqi.module.atmosphere.api.AnalysisUnavailableException;
import com.xingyun.dukongqi.module.atmosphere.application.port.AtmosphereAnalyzer;
import com.xingyun.dukongqi.module.atmosphere.domain.model.AtmosphereAnalysis;
import com.xingyun.dukongqi.module.atmosphere.domain.model.FlameIntensity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

/**
 * Atmosphere 模块 HTTP 契约验证：覆盖成功、入参校验与两类模块失败的响应。
 *
 * <p>分析能力以 Mock 替换，验证的是 HTTP 边界与异常翻译，不涉及外部模型。
 */
@SpringBootTest
class AtmosphereWebTest {

    private static final String LONG_TEXT = "这里是一段足够长的页面文本。".repeat(30);

    private final WebApplicationContext context;

    private MockMvc mockMvc;

    @MockitoBean
    private AtmosphereAnalyzer atmosphereAnalyzer;

    @Autowired
    AtmosphereWebTest(WebApplicationContext context) {
        this.context = context;
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    @DisplayName("分析成功返回 200 与完整的空气结果")
    void analyze_should_return_200_with_analysis() throws Exception {
        given(atmosphereAnalyzer.analyze(anyString()))
                .willReturn(analysis(87));

        mockMvc.perform(post("/atmosphere/analysis")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request(LONG_TEXT)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flameIntensity").value(87))
                .andExpect(jsonPath("$.level").value("FIERCE"))
                .andExpect(jsonPath("$.summary").value("观点对立明显"))
                .andExpect(jsonPath("$.evidence[0]").value("存在人身攻击"))
                .andExpect(jsonPath("$.confidence").value(0.9));
    }

    @Test
    @DisplayName("页面文本为空返回 400")
    void analyze_should_return_400_when_text_is_blank() throws Exception {
        mockMvc.perform(post("/atmosphere/analysis")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request("")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("内容不足以分析返回 422 ProblemDetail")
    void analyze_should_return_422_when_content_is_insufficient() throws Exception {
        mockMvc.perform(post("/atmosphere/analysis")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request("太短了")))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.title").value("Insufficient Content"))
                .andExpect(jsonPath("$.detail").value("页面内容不足以分析"));
    }

    @Test
    @DisplayName("分析能力不可用返回 503 ProblemDetail，且不泄漏内部信息")
    void analyze_should_return_503_when_analysis_is_unavailable() throws Exception {
        given(atmosphereAnalyzer.analyze(anyString()))
                .willThrow(new AnalysisUnavailableException("调用模型失败：connection timed out"));

        mockMvc.perform(post("/atmosphere/analysis")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request(LONG_TEXT)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.title").value("Analysis Unavailable"))
                .andExpect(jsonPath("$.detail").value("空气分析暂时不可用，请稍后再试"))
                .andExpect(result -> assertThat(result.getResponse().getContentAsString())
                        .doesNotContain("timed out"));
    }

    private static String request(String text) {
        return """
                {
                  "text": "%s"
                }
                """.formatted(text);
    }

    private static AtmosphereAnalysis analysis(int flameIntensity) {
        return new AtmosphereAnalysis(
                new FlameIntensity(flameIntensity),
                "观点对立明显",
                List.of("存在人身攻击"),
                0.9);
    }
}
