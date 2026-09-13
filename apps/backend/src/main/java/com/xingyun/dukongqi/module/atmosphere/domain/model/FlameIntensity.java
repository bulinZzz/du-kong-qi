package com.xingyun.dukongqi.module.atmosphere.domain.model;

/**
 * 骂战激烈程度：页面整体冲突与敌意程度的度量，取值 0～100。
 *
 * <p>该值刻画表达的对抗性，而不是观点的分歧：话题敏感或结论有争议本身不构成高分，
 * 因此不能由负面情绪的比例直接推出。
 */
public record FlameIntensity(int value) {

    private static final int MIN_VALUE = 0;
    private static final int MAX_VALUE = 100;

    public FlameIntensity {
        if (value < MIN_VALUE || value > MAX_VALUE) {
            throw new IllegalArgumentException(
                    "骂战激烈程度必须位于 " + MIN_VALUE + "～" + MAX_VALUE + " 之间，实际为 " + value);
        }
    }
}
