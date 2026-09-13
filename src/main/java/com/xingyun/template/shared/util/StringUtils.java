package com.xingyun.template.shared.util;

import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;

/**
 * 字符串工具类：全项目字符串处理的统一防腐层入口。
 *
 * <p>全项目禁止直接使用第三方 {@code StringUtils}，字符串工具调用统一经由本类。
 * 本类委托 Apache Commons Lang3，并对外明确声明 {@code null} 契约：
 * 标注 {@code @Nullable} 的参数与返回值允许为 {@code null}，其余均非 {@code null}。
 * 内部层调用须先经 {@code Objects.requireNonNull} 快速失败。</p>
 *
 * <p>本类无状态且线程安全。</p>
 */
@NullMarked
public final class StringUtils {

    private StringUtils() {
        throw new AssertionError("工具类禁止实例化");
    }

    /**
     * 判断字符串是否为 {@code null}、空串或仅由空白字符组成。
     *
     * <p>{@code isBlank(null)} / {@code isBlank("")} / {@code isBlank(" ")} → {@code true}；
     * {@code isBlank("abc")} → {@code false}。</p>
     *
     * @param cs 待检查的字符串，可为 {@code null}
     * @return 为 {@code null}、空串或纯空白时返回 {@code true}
     */
    public static boolean isBlank(final @Nullable String cs) {
        return org.apache.commons.lang3.StringUtils.isBlank(cs);
    }

    /**
     * 判断字符串是否非空且包含非空白字符（{@link #isBlank(String)} 的反义）。
     *
     * @param cs 待检查的字符串，可为 {@code null}
     * @return 非 {@code null} 且包含非空白字符时返回 {@code true}
     */
    public static boolean isNotBlank(final @Nullable String cs) {
        return org.apache.commons.lang3.StringUtils.isNotBlank(cs);
    }

    /**
     * 判断字符串是否为 {@code null} 或空串（空白字符不算空）。
     *
     * <p>{@code isEmpty(null)} / {@code isEmpty("")} → {@code true}；
     * {@code isEmpty(" ")} → {@code false}。</p>
     *
     * @param cs 待检查的字符串，可为 {@code null}
     * @return 为 {@code null} 或空串时返回 {@code true}
     */
    public static boolean isEmpty(final @Nullable String cs) {
        return org.apache.commons.lang3.StringUtils.isEmpty(cs);
    }

    /**
     * 判断字符串是否非 {@code null} 且长度大于 0（{@link #isEmpty(String)} 的反义）。
     *
     * @param cs 待检查的字符串，可为 {@code null}
     * @return 非 {@code null} 且长度大于 0 时返回 {@code true}
     */
    public static boolean isNotEmpty(final @Nullable String cs) {
        return org.apache.commons.lang3.StringUtils.isNotEmpty(cs);
    }
}
