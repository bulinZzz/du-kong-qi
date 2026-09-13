package com.xingyun.template.shared.exception;

/**
 * 业务规则拒绝：表示当前请求在业务语义上无法被接受。
 *
 * <p>该异常不携带 HTTP 语义，具体如何映射到外部协议由边界层决定。
 */
public class BusinessException extends RuntimeException {

    public BusinessException(String message) {
        super(message);
    }
}
