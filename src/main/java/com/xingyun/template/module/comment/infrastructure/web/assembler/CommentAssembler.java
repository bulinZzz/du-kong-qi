package com.xingyun.template.module.comment.infrastructure.web.assembler;

import com.xingyun.template.module.comment.api.CommentCreateCommand;
import com.xingyun.template.module.comment.api.CommentQuery;
import com.xingyun.template.module.comment.api.CommentResult;
import com.xingyun.template.module.comment.infrastructure.web.request.CommentCreateRequest;
import com.xingyun.template.module.comment.infrastructure.web.response.CommentResponse;
import org.springframework.stereotype.Component;

/**
 * HTTP 词汇（Request/Response）↔ 契约词汇（Command/Query/Result）的转换器：只映射数据，不编排用例。
 */
@Component
public class CommentAssembler {

    /**
     * Request 转入参契约：字段校验已由框架在入站时完成。
     */
    public CommentCreateCommand toCommand(CommentCreateRequest request) {
        return new CommentCreateCommand(request.exampleId(), request.content());
    }

    /**
     * 查询参数转查询条件契约。
     */
    public CommentQuery toQuery(Long exampleId) {
        return new CommentQuery(exampleId);
    }

    /**
     * 出参契约转 Response：强类型标识在此还原为裸值。
     */
    public CommentResponse toResponse(CommentResult result) {
        return new CommentResponse(result.id().value(), result.exampleId(), result.content());
    }
}
