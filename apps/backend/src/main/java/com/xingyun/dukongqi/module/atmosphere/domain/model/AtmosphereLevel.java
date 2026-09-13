package com.xingyun.dukongqi.module.atmosphere.domain.model;

/**
 * 空气等级：由骂战激烈程度划分的有限档位。
 *
 * <p>档位区间即评分口径中的分段标准，两者必须同步调整。本枚举只表达稳定的等级语义，
 * 等级对应的用户措辞由客户端决定，不进入契约。
 */
public enum AtmosphereLevel {

    /** 0～20：基本平和。 */
    PEACEFUL(0, 20),

    /** 21～40：存在不同意见，但交流总体平稳。 */
    REASONABLE(21, 40),

    /** 41～60：争论比较明显，开始出现较强情绪。 */
    DEBATING(41, 60),

    /** 61～80：对立明显，攻击、讽刺或情绪升级较多。 */
    HOSTILE(61, 80),

    /** 81～100：高度激烈，已经形成明显骂战。 */
    FIERCE(81, 100);

    private final int lowerBound;
    private final int upperBound;

    AtmosphereLevel(int lowerBound, int upperBound) {
        this.lowerBound = lowerBound;
        this.upperBound = upperBound;
    }

    /**
     * 按骂战激烈程度定位空气等级。
     *
     * @param intensity 骂战激烈程度，不得为 {@code null}
     * @return 覆盖该分值的等级
     */
    public static AtmosphereLevel from(FlameIntensity intensity) {
        for (AtmosphereLevel level : values()) {
            if (intensity.value() >= level.lowerBound && intensity.value() <= level.upperBound) {
                return level;
            }
        }
        throw new IllegalArgumentException("没有覆盖该分值的空气等级：" + intensity.value());
    }
}
