package com.xingyun.dukongqi.module.atmosphere.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.xingyun.dukongqi.module.atmosphere.api.AtmosphereAnalysisCommand;
import com.xingyun.dukongqi.module.atmosphere.api.AtmosphereAnalysisResult;
import com.xingyun.dukongqi.module.atmosphere.api.InsufficientContentException;
import com.xingyun.dukongqi.module.atmosphere.application.port.AtmosphereAnalyzer;
import com.xingyun.dukongqi.module.atmosphere.domain.model.AtmosphereAnalysis;
import com.xingyun.dukongqi.module.atmosphere.domain.model.AtmosphereLevel;
import com.xingyun.dukongqi.module.atmosphere.domain.model.FlameIntensity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 一次空气分析的用例验证：输入规范化、内容充足性判断与结果映射。
 *
 * <p>分析能力以桩替换，验证的是用例编排本身，不涉及外部模型。
 */
class AtmosphereAnalysisApiImplTest {

    private static final String LONG_TEXT = "这里是一段足够长的页面文本。".repeat(30);

    @Test
    @DisplayName("内容不足时拒绝，且不发起分析")
    void analyze_should_reject_insufficient_content_without_analyzing() {
        AtomicReference<String> received = new AtomicReference<>();
        AtmosphereAnalysisApiImpl api = new AtmosphereAnalysisApiImpl(stub(received));

        assertThatThrownBy(() -> api.analyze(new AtmosphereAnalysisCommand("太短了")))
                .isInstanceOf(InsufficientContentException.class)
                .hasMessage("页面内容不足以分析");
        assertThat(received).hasNullValue();
    }

    @Test
    @DisplayName("提交前逐行去空白、丢弃空行，保留行边界")
    void analyze_should_normalize_content() {
        AtomicReference<String> received = new AtomicReference<>();
        AtmosphereAnalysisApiImpl api = new AtmosphereAnalysisApiImpl(stub(received));

        api.analyze(new AtmosphereAnalysisCommand("  第一行\n\n\n   第二行" + LONG_TEXT));

        assertThat(received.get()).startsWith("第一行\n第二行").doesNotContain("\n\n");
    }

    @Test
    @DisplayName("超长内容截断到上限后提交")
    void analyze_should_truncate_long_content() {
        AtomicReference<String> received = new AtomicReference<>();
        AtmosphereAnalysisApiImpl api = new AtmosphereAnalysisApiImpl(stub(received));

        api.analyze(new AtmosphereAnalysisCommand("字".repeat(12000)));

        assertThat(received.get()).hasSize(10000);
    }

    @Test
    @DisplayName("分析结果按出参契约返回")
    void analyze_should_map_analysis_to_result() {
        AtmosphereAnalysisApiImpl api = new AtmosphereAnalysisApiImpl(stub(new AtomicReference<>()));

        AtmosphereAnalysisResult result = api.analyze(new AtmosphereAnalysisCommand(LONG_TEXT));

        assertThat(result.flameIntensity()).isEqualTo(new FlameIntensity(87));
        assertThat(result.level()).isEqualTo(AtmosphereLevel.FIERCE);
        assertThat(result.summary()).isEqualTo("观点对立明显");
        assertThat(result.evidence()).containsExactly("存在人身攻击");
        assertThat(result.confidence()).isEqualTo(0.9);
    }

    @Test
    @DisplayName("文本为 null 时快速失败")
    void analyze_should_fail_fast_when_text_is_null() {
        AtmosphereAnalysisApiImpl api = new AtmosphereAnalysisApiImpl(stub(new AtomicReference<>()));

        assertThatThrownBy(() -> api.analyze(new AtmosphereAnalysisCommand(null)))
                .isInstanceOf(NullPointerException.class)
                .hasMessage("AtmosphereAnalysisCommand 的 text 不能为 null");
    }

    private static AtmosphereAnalyzer stub(AtomicReference<String> received) {
        return content -> {
            received.set(content);
            return new AtmosphereAnalysis(
                    new FlameIntensity(87),
                    "观点对立明显",
                    List.of("存在人身攻击"),
                    0.9);
        };
    }
}
