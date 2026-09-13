package com.xingyun.dukongqi.module.atmosphere.api;

import com.xingyun.dukongqi.module.atmosphere.domain.model.AtmosphereLevel;
import com.xingyun.dukongqi.module.atmosphere.domain.model.FlameIntensity;

import java.util.List;

/**
 * 空气分析的出参契约。
 *
 * @param flameIntensity 骂战激烈程度
 * @param level          由激烈程度定位的空气等级，客户端据此决定措辞
 * @param summary        一句话空气判断
 * @param evidence       判断依据
 * @param confidence     结果置信度，取值 0～1
 */
public record AtmosphereAnalysisResult(
        FlameIntensity flameIntensity,
        AtmosphereLevel level,
        String summary,
        List<String> evidence,
        double confidence) {
}
