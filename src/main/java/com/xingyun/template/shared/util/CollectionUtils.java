package com.xingyun.template.shared.util;

import org.jspecify.annotations.NullMarked;
import org.jspecify.annotations.Nullable;

import java.util.Collection;
import java.util.Map;

/**
 * 集合工具类：全项目集合处理的统一防腐层入口。
 *
 * <p>全项目禁止直接使用第三方 {@code CollectionUtils}，集合工具调用统一经由本类。
 * 本类委托 Spring Framework 的 {@code CollectionUtils}，并对外明确声明 {@code null} 契约：
 * 标注 {@code @Nullable} 的参数与返回值允许为 {@code null}，其余均非 {@code null}。
 * 内部层调用须先经 {@code Objects.requireNonNull} 快速失败。</p>
 *
 * <p>本类无状态且线程安全。</p>
 */
@NullMarked
public final class CollectionUtils {

    private CollectionUtils() {
        throw new AssertionError("工具类禁止实例化");
    }

    /**
     * 判断集合是否为 {@code null} 或不含任何元素。
     *
     * <p>{@code isEmpty(null)} / {@code isEmpty(List.of())} → {@code true}；
     * {@code isEmpty(List.of("a"))} → {@code false}。</p>
     *
     * @param collection 待检查的集合，可为 {@code null}
     * @return 为 {@code null} 或空集合时返回 {@code true}
     */
    public static boolean isEmpty(final @Nullable Collection<?> collection) {
        return org.springframework.util.CollectionUtils.isEmpty(collection);
    }

    /**
     * 判断集合是否非 {@code null} 且包含元素（{@link #isEmpty(Collection)} 的反义）。
     *
     * @param collection 待检查的集合，可为 {@code null}
     * @return 非 {@code null} 且包含元素时返回 {@code true}
     */
    public static boolean isNotEmpty(final @Nullable Collection<?> collection) {
        return !isEmpty(collection);
    }

    /**
     * 判断 Map 是否为 {@code null} 或不含任何键值对。
     *
     * <p>{@code isEmpty(null)} / {@code isEmpty(Map.of())} → {@code true}；
     * {@code isEmpty(Map.of("k", "v"))} → {@code false}。</p>
     *
     * @param map 待检查的 Map，可为 {@code null}
     * @return 为 {@code null} 或空 Map 时返回 {@code true}
     */
    public static boolean isEmpty(final @Nullable Map<?, ?> map) {
        return org.springframework.util.CollectionUtils.isEmpty(map);
    }

    /**
     * 判断 Map 是否非 {@code null} 且包含键值对（{@link #isEmpty(Map)} 的反义）。
     *
     * @param map 待检查的 Map，可为 {@code null}
     * @return 非 {@code null} 且包含键值对时返回 {@code true}
     */
    public static boolean isNotEmpty(final @Nullable Map<?, ?> map) {
        return !isEmpty(map);
    }
}
