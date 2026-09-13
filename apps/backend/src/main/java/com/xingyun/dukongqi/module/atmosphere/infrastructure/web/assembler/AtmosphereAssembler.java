package com.xingyun.dukongqi.module.atmosphere.infrastructure.web.assembler;

import com.xingyun.dukongqi.module.atmosphere.api.AtmosphereAnalysisCommand;
import com.xingyun.dukongqi.module.atmosphere.api.AtmosphereAnalysisResult;
import com.xingyun.dukongqi.module.atmosphere.infrastructure.web.request.AtmosphereAnalysisRequest;
import com.xingyun.dukongqi.module.atmosphere.infrastructure.web.response.AtmosphereAnalysisResponse;
import org.springframework.stereotype.Component;

/**
 * HTTP 词汇（Request/Response）↔ 契约词汇（Command/Result）的转换器：
 * 只映射数据，不编排用例。
 */
@Component
public class AtmosphereAssembler {

    /**
     * Request 转入参契约：字段校验已由框架在入站时完成。
     */
    public AtmosphereAnalysisCommand toCommand(AtmosphereAnalysisRequest request) {
        return new AtmosphereAnalysisCommand(request.text());
    }

    /**
     * 出参契约转 Response：领域类型在此还原为裸值。
     */
    public AtmosphereAnalysisResponse toResponse(AtmosphereAnalysisResult result) {
        return new AtmosphereAnalysisResponse(
                result.flameIntensity().value(),
                result.level().name(),
                result.summary(),
                result.evidence(),
                result.confidence());
    }
}
