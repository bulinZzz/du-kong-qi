package com.xingyun.dukongqi.module.atmosphere.domain.model;

import com.xingyun.dukongqi.shared.util.StringUtils;

import java.util.List;
import java.util.Objects;

/**
 * 空气分析结果：一次分析的全部结论，构造即校验其是否可用。
 *
 * <p>结论来自外部模型输出，因此判断语缺失、依据为空或置信度越界都表示结果不可用，
 * 构造时即拒绝。对象不可变，可安全共享。
 */
public record AtmosphereAnalysis(
        FlameIntensity flameIntensity,
        String summary,
        List<String> evidence,
        double confidence) {

    public AtmosphereAnalysis {
        Objects.requireNonNull(flameIntensity, "AtmosphereAnalysis 的 flameIntensity 不能为 null");
        Objects.requireNonNull(evidence, "AtmosphereAnalysis 的 evidence 不能为 null");
        if (StringUtils.isBlank(summary)) {
            throw new IllegalArgumentException("空气判断不能为空");
        }
        if (evidence.isEmpty()) {
            throw new IllegalArgumentException("判断依据不能为空");
        }
        if (evidence.stream().anyMatch(StringUtils::isBlank)) {
            throw new IllegalArgumentException("判断依据不能包含空内容");
        }
        if (confidence < 0 || confidence > 1) {
            throw new IllegalArgumentException("置信度必须位于 0～1 之间，实际为 " + confidence);
        }
        evidence = List.copyOf(evidence);
    }

    /**
     * 由骂战激烈程度定位的空气等级。
     */
    public AtmosphereLevel level() {
        return AtmosphereLevel.from(flameIntensity);
    }
}
