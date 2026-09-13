package com.xingyun.dukongqi.module.atmosphere.application.port;

import com.xingyun.dukongqi.module.atmosphere.api.AnalysisUnavailableException;
import com.xingyun.dukongqi.module.atmosphere.domain.model.AtmosphereAnalysis;

/**
 * 空气分析能力：由外部模型判断页面的空气。
 *
 * <p>实现负责外部协议适配与结果校验：只有在得到一次合法分析时才返回，
 * 调用失败、超时或输出不符合约定时抛出 {@link AnalysisUnavailableException}。
 */
@FunctionalInterface
public interface AtmosphereAnalyzer {

    /**
     * 分析页面空气。
     *
     * @param content 页面主要文本，不得为 {@code null}
     * @return 合法的分析结果
     * @throws AnalysisUnavailableException 外部能力不可用或返回结果不可用
     */
    AtmosphereAnalysis analyze(String content);
}
