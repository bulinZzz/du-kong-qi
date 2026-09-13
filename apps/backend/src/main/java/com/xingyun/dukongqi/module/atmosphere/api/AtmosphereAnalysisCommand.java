package com.xingyun.dukongqi.module.atmosphere.api;

/**
 * 空气分析的入参契约：分析对象是页面主要文本。
 *
 * @param text 页面主要文本，已由客户端完成基础提取
 */
public record AtmosphereAnalysisCommand(String text) {
}
