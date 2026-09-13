package com.xingyun.dukongqi.module.atmosphere.infrastructure.web.controller;

import com.xingyun.dukongqi.module.atmosphere.api.AtmosphereAnalysisApi;
import com.xingyun.dukongqi.module.atmosphere.api.AtmosphereAnalysisCommand;
import com.xingyun.dukongqi.module.atmosphere.infrastructure.web.assembler.AtmosphereAssembler;
import com.xingyun.dukongqi.module.atmosphere.infrastructure.web.request.AtmosphereAnalysisRequest;
import com.xingyun.dukongqi.module.atmosphere.infrastructure.web.response.AtmosphereAnalysisResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 空气分析模块的 HTTP 适配器：只做协议转换与编解码，用例编排委托 api 契约接口
 * AtmosphereAnalysisApi——即便同模块也只依赖 api 公开面，不引用 application/service 的实现类。
 */
@RestController
@RequestMapping("/atmosphere")
public class AtmosphereController {

    private final AtmosphereAnalysisApi atmosphereAnalysisApi;
    private final AtmosphereAssembler atmosphereAssembler;

    public AtmosphereController(
            AtmosphereAnalysisApi atmosphereAnalysisApi,
            AtmosphereAssembler atmosphereAssembler) {
        this.atmosphereAnalysisApi = atmosphereAnalysisApi;
        this.atmosphereAssembler = atmosphereAssembler;
    }

    /**
     * 分析页面当前空气：请求校验失败由框架返回 400，内容不足返回 422，
     * 分析能力不可用返回 503，成功返回 200。
     */
    @PostMapping("/analysis")
    public AtmosphereAnalysisResponse analyze(@Valid @RequestBody AtmosphereAnalysisRequest request) {
        AtmosphereAnalysisCommand command = atmosphereAssembler.toCommand(request);
        return atmosphereAssembler.toResponse(atmosphereAnalysisApi.analyze(command));
    }
}
