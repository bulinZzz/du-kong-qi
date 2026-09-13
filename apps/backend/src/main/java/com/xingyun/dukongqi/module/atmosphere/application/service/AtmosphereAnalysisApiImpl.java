package com.xingyun.dukongqi.module.atmosphere.application.service;

import com.xingyun.dukongqi.module.atmosphere.api.AtmosphereAnalysisCommand;
import com.xingyun.dukongqi.module.atmosphere.api.AtmosphereAnalysisApi;
import com.xingyun.dukongqi.module.atmosphere.api.AtmosphereAnalysisResult;
import com.xingyun.dukongqi.module.atmosphere.api.InsufficientContentException;
import com.xingyun.dukongqi.module.atmosphere.application.port.AtmosphereAnalyzer;
import com.xingyun.dukongqi.module.atmosphere.domain.model.AtmosphereAnalysis;
import com.xingyun.dukongqi.shared.util.StringUtils;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.stream.Collectors;

/**
 * AtmosphereAnalysisApi 的应用服务实现：编排一次空气分析，
 * 内聚契约 DTO 与领域模型之间的转换。
 */
@Service
public class AtmosphereAnalysisApiImpl implements AtmosphereAnalysisApi {

    /**
     * 低于该字符数视为内容不足以支撑分析。
     */
    private static final int MIN_ANALYZABLE_LENGTH = 200;

    /**
     * 提交给分析能力的文本长度上限，超出部分不参与分析。
     */
    private static final int MAX_CONTENT_LENGTH = 10000;

    private final AtmosphereAnalyzer atmosphereAnalyzer;

    public AtmosphereAnalysisApiImpl(AtmosphereAnalyzer atmosphereAnalyzer) {
        this.atmosphereAnalyzer = atmosphereAnalyzer;
    }

    @Override
    public AtmosphereAnalysisResult analyze(AtmosphereAnalysisCommand command) {
        String content = normalize(command.text());
        AtmosphereAnalysis analysis = atmosphereAnalyzer.analyze(content);
        return toResult(analysis);
    }

    /**
     * 规范化页面文本并执行长度约束：逐行去除首尾空白、丢弃空行，
     * 保留行边界以维持讨论的发言结构。
     */
    private static String normalize(String text) {
        Objects.requireNonNull(text, "AtmosphereAnalysisCommand 的 text 不能为 null");

        String normalized = text.lines()
                .map(String::strip)
                .filter(StringUtils::isNotBlank)
                .collect(Collectors.joining("\n"));

        if (normalized.length() < MIN_ANALYZABLE_LENGTH) {
            throw new InsufficientContentException("页面内容不足以分析");
        }
        return normalized.length() > MAX_CONTENT_LENGTH
                ? normalized.substring(0, MAX_CONTENT_LENGTH)
                : normalized;
    }

    private static AtmosphereAnalysisResult toResult(AtmosphereAnalysis analysis) {
        return new AtmosphereAnalysisResult(
                analysis.flameIntensity(),
                analysis.level(),
                analysis.summary(),
                analysis.evidence(),
                analysis.confidence());
    }
}
