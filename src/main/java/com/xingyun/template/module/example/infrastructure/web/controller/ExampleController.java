package com.xingyun.template.module.example.infrastructure.web.controller;

import com.xingyun.template.module.example.api.ExampleApi;
import com.xingyun.template.module.example.api.ExampleCreateCommand;
import com.xingyun.template.module.example.api.ExampleRenameCommand;
import com.xingyun.template.module.example.api.ExampleResult;
import com.xingyun.template.module.example.domain.model.ExampleId;
import com.xingyun.template.module.example.infrastructure.web.assembler.ExampleAssembler;
import com.xingyun.template.module.example.infrastructure.web.request.ExampleCreateRequest;
import com.xingyun.template.module.example.infrastructure.web.request.ExampleRenameRequest;
import com.xingyun.template.module.example.infrastructure.web.response.ExampleResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

/**
 * 示例模块的 HTTP 适配器：只做协议转换与编解码，用例编排委托 api 契约接口
 * ExampleApi——即便同模块也只依赖 api 公开面，不引用 application/service 的实现类。
 */
@RestController
@RequestMapping("/examples")
public class ExampleController {

    private final ExampleApi exampleApi;
    private final ExampleAssembler exampleAssembler;

    public ExampleController(ExampleApi exampleApi, ExampleAssembler exampleAssembler) {
        this.exampleApi = exampleApi;
        this.exampleAssembler = exampleAssembler;
    }

    /**
     * 创建示例聚合：校验失败由框架返回 400，成功返回 201 并在 Location 指向新资源。
     */
    @PostMapping
    public ResponseEntity<ExampleResponse> create(@Valid @RequestBody ExampleCreateRequest request) {
        ExampleCreateCommand command = exampleAssembler.toCommand(request);
        ExampleResult result = exampleApi.create(command);
        return ResponseEntity.created(URI.create("/examples/" + result.id().value()))
                .body(exampleAssembler.toResponse(result));
    }

    /**
     * 按标识查询示例聚合：不存在返回 404。
     */
    @GetMapping("/{id}")
    public ResponseEntity<ExampleResponse> findById(@PathVariable Long id) {
        return exampleApi.findById(new ExampleId(id))
                .map(exampleAssembler::toResponse)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * 重命名示例聚合：不存在返回 404，同名拒绝（聚合不变量违规）由全局异常翻译器
     * 转为 409，成功返回 204。
     */
    @PutMapping("/{id}")
    public ResponseEntity<Void> rename(@PathVariable Long id, @Valid @RequestBody ExampleRenameRequest request) {
        ExampleRenameCommand command = exampleAssembler.toCommand(new ExampleId(id), request);
        return exampleApi.rename(command)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
