package com.xingyun.template.shared.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 仅供测试的端点：固定抛出未预期异常，用于验证全局异常处理器在完整 HTTP 链路中的兜底行为。
 *
 * <p>该类仅存在于 test source set，不进入生产制品，也不承载任何业务逻辑。
 */
@RestController
class UnexpectedExceptionTestController {

    @GetMapping("/test/unexpected-exception")
    void throwException() {
        throw new IllegalStateException("internal-secret");
    }
}
