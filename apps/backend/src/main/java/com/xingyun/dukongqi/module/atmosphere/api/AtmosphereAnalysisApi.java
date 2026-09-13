package com.xingyun.dukongqi.module.atmosphere.api;

/**
 * 空气分析模块对外契约：本模块全部对外能力的唯一视图。
 *
 * <p>单契约模式：本接口即应用服务接口，{@code @Service} 实现类位于
 * {@code application/service}，契约 DTO 与领域模型的转换内聚在实现类中。
 */
public interface AtmosphereAnalysisApi {

    /**
     * 分析页面当前空气。
     *
     * @param command 页面主要文本，不得为 {@code null}
     * @return 分析结果
     * @throws InsufficientContentException 提交的内容不足以支撑分析
     * @throws AnalysisUnavailableException 分析能力暂时不可用，调用方可以重试
     */
    AtmosphereAnalysisResult analyze(AtmosphereAnalysisCommand command);
}
