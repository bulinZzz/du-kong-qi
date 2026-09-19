package com.xingyun.dukongqi.shared.web;

import com.xingyun.dukongqi.shared.exception.OriginNotAllowedException;
import com.xingyun.dukongqi.shared.exception.RequestQuotaExceededException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Clock;
import java.time.LocalDate;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 对外接口的准入与限流。
 *
 * <p>两道闸：请求只能来自允许的来源（按 Origin 判断），以及按来源 IP 与每日总量计数。
 *
 * <p>计数放在内存里。当前只部署单实例，重启清零，这是可接受的代价；多实例部署时
 * 这里要换成集中式计数，否则每个实例各算一份，实际额度会翻倍。
 *
 * <p>来源 IP 取自请求。反代之后必须让代理写入 X-Forwarded-For
 * （见 application.yml 的 {@code server.forward-headers-strategy}），
 * 否则所有请求都算到同一个 IP 上，按 IP 的那道闸会误伤所有人。
 *
 * <p>过了闸的请求，无论最终成败都计入当日额度：它计的是请求数，不是模型调用数。
 *
 * <p>日期按 UTC 划分：这只是个成本闸门，不必跟用户的时区对齐，而固定时区让测试可预期。
 */
@Slf4j
@Component
public class ApiGuardInterceptor implements HandlerInterceptor {

    /** 按 IP 计数的窗口长度。 */
    private static final Duration WINDOW = Duration.ofMinutes(1);

    /** 窗口表大到这个规模时顺手清一次过期窗口，免得被大量来源 IP 撑大内存。 */
    private static final int PURGE_THRESHOLD = 1024;

    /** 未配置允许来源时，最多记下这么多见过的来源，够看出客户端送的是什么就行。 */
    private static final int MAX_NOTED_ORIGINS = 20;

    private final ApiGuardProperties properties;
    private final Clock clock;
    private final Map<String, MinuteWindow> windows = new ConcurrentHashMap<>();
    private final DailyBudget dailyBudget = new DailyBudget();
    private final Set<String> notedOrigins = ConcurrentHashMap.newKeySet();

    /** 供测试构造：时间可拨动，窗口过期与跨日归零才是确定性的，不必真的等。 */
    public ApiGuardInterceptor(ApiGuardProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;

        if (properties.allowedOrigins().isEmpty()) {
            log.warn("api-guard.allowed-origins 未配置：不校验请求来源，任何来源都可调用接口");
        }
    }

    /** 供 Spring 装配：时间取系统时间，按 UTC 划分日期。 */
    @Autowired
    public ApiGuardInterceptor(ApiGuardProperties properties) {
        this(properties, Clock.systemUTC());
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        verifyOrigin(request);

        long now = clock.millis();
        verifyPerIpLimit(request.getRemoteAddr(), now);
        verifyDailyLimit(now);

        return true;
    }

    private void verifyOrigin(HttpServletRequest request) {
        String origin = request.getHeader(HttpHeaders.ORIGIN);

        if (properties.allowedOrigins().isEmpty()) {
            noteOrigin(origin);
            return;
        }

        boolean allowed = origin != null
                && properties.allowedOrigins().stream().anyMatch(candidate -> candidate.equalsIgnoreCase(origin));
        if (!allowed) {
            throw new OriginNotAllowedException(String.valueOf(origin));
        }
    }

    private void verifyPerIpLimit(String ip, long now) {
        purgeStaleWindows(now);

        int count = windows.computeIfAbsent(ip, key -> new MinuteWindow()).tryAcquire(now);
        if (count == properties.perIpPerMinute() + 1) {
            log.warn("来源 {} 每分钟请求数超出上限 {}", ip, properties.perIpPerMinute());
        }
        if (count > properties.perIpPerMinute()) {
            throw new RequestQuotaExceededException(RequestQuotaExceededException.Reason.PER_IP);
        }
    }

    private void verifyDailyLimit(long now) {
        if (!dailyBudget.tryAcquire(LocalDate.now(clock), properties.dailyLimit())) {
            log.warn("当日额度已用完（上限 {}）", properties.dailyLimit());
            throw new RequestQuotaExceededException(RequestQuotaExceededException.Reason.DAILY);
        }
    }

    /**
     * 记下见到的来源，每个只记一次。
     *
     * <p>只在没配置允许来源时做：上线前正是靠它看清客户端送来的究竟是什么，不必靠猜。
     */
    private void noteOrigin(String origin) {
        if (origin == null || notedOrigins.size() >= MAX_NOTED_ORIGINS || !notedOrigins.add(origin)) {
            return;
        }
        log.info("收到未校验来源的请求，来源：{}", origin);
    }

    private void purgeStaleWindows(long now) {
        if (windows.size() > PURGE_THRESHOLD) {
            windows.values().removeIf(window -> window.isStale(now));
        }
    }

    /** 一个来源 IP 在当前窗口内的请求计数。 */
    private static final class MinuteWindow {

        private long startedAt;
        private int count;

        /** 计入一次请求并返回本窗口内的累计次数。 */
        synchronized int tryAcquire(long now) {
            if (now - startedAt >= WINDOW.toMillis()) {
                startedAt = now;
                count = 0;
            }
            return ++count;
        }

        synchronized boolean isStale(long now) {
            return now - startedAt >= WINDOW.toMillis();
        }
    }

    /** 全部请求的每日计数，跨过零点自动归零。 */
    private static final class DailyBudget {

        private LocalDate day;
        private int count;

        /** 额度未用完则计入一次请求并返回 true。 */
        synchronized boolean tryAcquire(LocalDate today, int limit) {
            if (!today.equals(day)) {
                day = today;
                count = 0;
            }
            if (count >= limit) {
                return false;
            }
            count++;
            return true;
        }
    }
}
