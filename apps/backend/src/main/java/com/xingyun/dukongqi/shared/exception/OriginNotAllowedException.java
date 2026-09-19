package com.xingyun.dukongqi.shared.exception;

/**
 * 请求来源不在允许范围内。
 *
 * <p>对外接口只服务于本产品自己的客户端，其他来源一律拒绝。
 * 与业务领域无关、可被多个模块复用，故放在 shared；HTTP 状态由 Web 边界翻译。
 *
 * <p>异常信息带上来源，只用于日志排查；响应里不回显它，免得把对方送来的内容原样弹回去。
 */
public class OriginNotAllowedException extends RuntimeException {

    public OriginNotAllowedException(String origin) {
        super("请求来源不被允许：" + origin);
    }
}
