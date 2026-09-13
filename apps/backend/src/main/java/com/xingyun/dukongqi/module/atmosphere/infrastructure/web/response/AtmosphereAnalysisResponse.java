package com.xingyun.dukongqi.module.atmosphere.infrastructure.web.response;

import java.util.List;

/**
 * 空气分析的 HTTP 出参：字段以裸值表达，领域类型不越过 HTTP 边界。
 *
 * @param level 空气等级代码，客户端据此决定面向用户的措辞
 */
public record AtmosphereAnalysisResponse(
        int flameIntensity,
        String level,
        String summary,
        List<String> evidence,
        double confidence) {
}
