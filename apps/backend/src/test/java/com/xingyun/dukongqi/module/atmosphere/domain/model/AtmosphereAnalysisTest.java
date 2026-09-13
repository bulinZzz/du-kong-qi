package com.xingyun.dukongqi.module.atmosphere.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;

/**
 * AtmosphereAnalysis 单元测试：覆盖结果的可用性校验与等级映射。
 */
class AtmosphereAnalysisTest {

    @Nested
    @DisplayName("构造：结果可用性校验")
    class Construct {

        @Test
        @DisplayName("字段齐全时按入参持有")
        void construct_should_hold_fields() {
            AtmosphereAnalysis analysis = analysis(87);

            assertThat(analysis.flameIntensity()).isEqualTo(new FlameIntensity(87));
            assertThat(analysis.summary()).isEqualTo("观点对立明显");
            assertThat(analysis.evidence()).containsExactly("存在人身攻击");
            assertThat(analysis.confidence()).isEqualTo(0.9);
        }

        @Test
        @DisplayName("激烈程度越界时拒绝")
        void construct_should_reject_intensity_out_of_range() {
            assertThatThrownBy(() -> new FlameIntensity(101))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("骂战激烈程度必须位于 0～100 之间");
        }

        @Test
        @DisplayName("判断语为空时拒绝")
        void construct_should_reject_blank_summary() {
            assertThatThrownBy(() -> new AtmosphereAnalysis(
                    new FlameIntensity(50), "  ", List.of("依据"), 0.5))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("空气判断不能为空");
        }

        @Test
        @DisplayName("判断依据为空时拒绝")
        void construct_should_reject_empty_evidence() {
            assertThatThrownBy(() -> new AtmosphereAnalysis(
                    new FlameIntensity(50), "判断", List.of(), 0.5))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("判断依据不能为空");
        }

        @Test
        @DisplayName("判断依据含空内容时拒绝")
        void construct_should_reject_blank_evidence_entry() {
            assertThatThrownBy(() -> new AtmosphereAnalysis(
                    new FlameIntensity(50), "判断", List.of(" "), 0.5))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("判断依据不能包含空内容");
        }

        @Test
        @DisplayName("置信度越界时拒绝")
        void construct_should_reject_confidence_out_of_range() {
            assertThatThrownBy(() -> new AtmosphereAnalysis(
                    new FlameIntensity(50), "判断", List.of("依据"), 1.2))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("置信度必须位于 0～1 之间");
        }
    }

    @Nested
    @DisplayName("level：等级映射")
    class Level {

        @Test
        @DisplayName("分段边界上的分值归属正确")
        void level_should_map_segment_boundaries() {
            assertThat(analysis(0).level()).isEqualTo(AtmosphereLevel.PEACEFUL);
            assertThat(analysis(20).level()).isEqualTo(AtmosphereLevel.PEACEFUL);
            assertThat(analysis(21).level()).isEqualTo(AtmosphereLevel.REASONABLE);
            assertThat(analysis(40).level()).isEqualTo(AtmosphereLevel.REASONABLE);
            assertThat(analysis(41).level()).isEqualTo(AtmosphereLevel.DEBATING);
            assertThat(analysis(60).level()).isEqualTo(AtmosphereLevel.DEBATING);
            assertThat(analysis(61).level()).isEqualTo(AtmosphereLevel.HOSTILE);
            assertThat(analysis(80).level()).isEqualTo(AtmosphereLevel.HOSTILE);
            assertThat(analysis(81).level()).isEqualTo(AtmosphereLevel.FIERCE);
            assertThat(analysis(100).level()).isEqualTo(AtmosphereLevel.FIERCE);
        }
    }

    private static AtmosphereAnalysis analysis(int flameIntensity) {
        return new AtmosphereAnalysis(
                new FlameIntensity(flameIntensity),
                "观点对立明显",
                List.of("存在人身攻击"),
                0.9);
    }
}
