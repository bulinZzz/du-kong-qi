package com.xingyun.dukongqi.module.atmosphere.api;

/**
 * 空气分析暂时不可用：外部分析能力调用失败、超时，或其返回结果无法作为一次有效分析。
 *
 * <p>属于可重试的暂时性失败，不表示提交的内容有问题。
 */
public class AnalysisUnavailableException extends RuntimeException {

    public AnalysisUnavailableException(String message) {
        super(message);
    }

    public AnalysisUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
