package com.xingyun.template.module.comment.infrastructure.web.controller;

import com.xingyun.template.module.comment.api.CommentApi;
import com.xingyun.template.module.comment.api.CommentCreateCommand;
import com.xingyun.template.module.comment.infrastructure.web.assembler.CommentAssembler;
import com.xingyun.template.module.comment.infrastructure.web.request.CommentCreateRequest;
import com.xingyun.template.module.comment.infrastructure.web.response.CommentResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

/**
 * 评论模块的 HTTP 适配器：只做协议转换与编解码，用例编排委托 api 契约接口
 * CommentApi——即便同模块也只依赖 api 公开面，不引用 application/service 的实现类。
 */
@RestController
@RequestMapping("/comments")
public class CommentController {

    private final CommentApi commentApi;
    private final CommentAssembler commentAssembler;

    public CommentController(CommentApi commentApi, CommentAssembler commentAssembler) {
        this.commentApi = commentApi;
        this.commentAssembler = commentAssembler;
    }

    /**
     * 创建评论：引用的示例聚合不存在返回 404，校验失败由框架返回 400，
     * 成功返回 201 并在 Location 指向新资源。
     */
    @PostMapping
    public ResponseEntity<CommentResponse> create(@Valid @RequestBody CommentCreateRequest request) {
        CommentCreateCommand command = commentAssembler.toCommand(request);
        return commentApi.create(command)
                .map(result -> ResponseEntity
                        .created(URI.create("/comments/" + result.id().value()))
                        .body(commentAssembler.toResponse(result)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * 按引用的示例聚合列出评论。
     */
    @GetMapping
    public List<CommentResponse> listByExample(@RequestParam Long exampleId) {
        return commentApi.listByExample(commentAssembler.toQuery(exampleId)).stream()
                .map(commentAssembler::toResponse)
                .toList();
    }
}
