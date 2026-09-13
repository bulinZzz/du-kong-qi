package com.xingyun.dukongqi.module.atmosphere.api;

/**
 * 提交的内容不足以支撑空气分析：内容过短、几乎没有正文，或无法从中形成判断。
 */
public class InsufficientContentException extends RuntimeException {

    public InsufficientContentException(String message) {
        super(message);
    }
}
