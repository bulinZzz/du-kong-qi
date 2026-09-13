package com.xingyun.dukongqi.module.atmosphere.infrastructure.integration.openai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.xingyun.dukongqi.module.atmosphere.api.AnalysisUnavailableException;
import com.xingyun.dukongqi.module.atmosphere.api.InsufficientContentException;
import com.xingyun.dukongqi.module.atmosphere.domain.model.AtmosphereAnalysis;
import com.xingyun.dukongqi.module.atmosphere.domain.model.AtmosphereLevel;
import com.xingyun.dukongqi.module.atmosphere.domain.model.FlameIntensity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.List;

/**
 * 模型输出翻译为领域结果的验证：拒绝判断与结果不符合约定，分别落到不同的失败语义。
 */
class OpenAiAtmosphereAnalyzerTest {

    private final OpenAiAtmosphereAnalyzer analyzer = new OpenAiAtmosphereAnalyzer(
            new OpenAiProperties(
                    "https://example.com", "test-key", "test-model", Duration.ofSeconds(1)),
            new ObjectMapper());

    @Test
    @DisplayName("模型拒绝判断时翻译为内容不足")
    void should_translate_refusal_to_insufficient_content() {
        assertThatThrownBy(() -> analyzer.toAnalysis(response("""
                {
                  "insufficientContent": true
                }
                """)))
                .isInstanceOf(InsufficientContentException.class)
                .hasMessage("页面内容不足以分析");
    }

    @Test
    @DisplayName("结果缺少字段时翻译为分析不可用")
    void should_translate_missing_field_to_unavailable() {
        assertThatThrownBy(() -> analyzer.toAnalysis(response("""
                {
                  "flameIntensity": 87
                }
                """)))
                .isInstanceOf(AnalysisUnavailableException.class)
                .hasMessageContaining("缺少字段");
    }

    @Test
    @DisplayName("合法结果翻译为领域分析")
    void should_translate_valid_result() {
        AtmosphereAnalysis analysis = analyzer.toAnalysis(response("""
                {
                  "flameIntensity": 87,
                  "summary": "观点对立明显",
                  "evidence": ["存在人身攻击"],
                  "confidence": 0.9
                }
                """));

        assertThat(analysis.flameIntensity()).isEqualTo(new FlameIntensity(87));
        assertThat(analysis.level()).isEqualTo(AtmosphereLevel.FIERCE);
        assertThat(analysis.evidence()).containsExactly("存在人身攻击");
        assertThat(analysis.confidence()).isEqualTo(0.9);
    }

    private static OpenAiChatResponse response(String content) {
        return new OpenAiChatResponse(List.of(
                new OpenAiChatResponse.Choice(new OpenAiChatResponse.Message(content))));
    }
}
