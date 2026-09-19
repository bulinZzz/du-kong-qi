package com.xingyun.dukongqi.shared.exception;

/**
 * 请求超出配额。
 *
 * <p>与业务领域无关、可被多个模块复用，故放在 shared；HTTP 状态与响应文案由 Web 边界翻译。
 *
 * <p>只带语义——撞的是哪一道闸——不带面向用户的措辞：文案属于边界，改措辞不该动到异常。
 */
public class RequestQuotaExceededException extends RuntimeException {

    /** 撞的是哪一道闸。两种情况对用户的意义不同：一种"稍后再试"，一种"今天没有了"。 */
    public enum Reason {
        PER_IP,
        DAILY
    }

    private final Reason reason;

    public RequestQuotaExceededException(Reason reason) {
        super("请求超出配额：" + reason);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
