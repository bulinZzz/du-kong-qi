package com.xingyun.template.module.example.infrastructure.web.assembler;

import com.xingyun.template.module.example.api.ExampleCreateCommand;
import com.xingyun.template.module.example.api.ExampleRenameCommand;
import com.xingyun.template.module.example.api.ExampleResult;
import com.xingyun.template.module.example.domain.model.ExampleId;
import com.xingyun.template.module.example.infrastructure.web.request.ExampleCreateRequest;
import com.xingyun.template.module.example.infrastructure.web.request.ExampleRenameRequest;
import com.xingyun.template.module.example.infrastructure.web.response.ExampleResponse;
import org.springframework.stereotype.Component;

/**
 * HTTP 词汇（Request/Response）↔ 契约词汇（Command/Result）的转换器：只映射数据，不编排用例。
 */
@Component
public class ExampleAssembler {

    /**
     * Request 转入参契约：字段校验已由框架在入站时完成。
     */
    public ExampleCreateCommand toCommand(ExampleCreateRequest request) {
        return new ExampleCreateCommand(request.code(), request.name());
    }

    /**
     * Request 转入参契约（携带路径标识）：字段校验已由框架在入站时完成。
     */
    public ExampleRenameCommand toCommand(ExampleId id, ExampleRenameRequest request) {
        return new ExampleRenameCommand(id, request.name());
    }

    /**
     * 出参契约转 Response：强类型标识在此还原为裸值。
     */
    public ExampleResponse toResponse(ExampleResult result) {
        return new ExampleResponse(result.id().value(), result.code(), result.name());
    }
}
