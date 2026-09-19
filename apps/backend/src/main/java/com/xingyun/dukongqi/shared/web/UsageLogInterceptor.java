package com.xingyun.dukongqi.shared.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Duration;
import java.util.regex.Pattern;

/**
 * 对外接口的用量记录：每次调用一行，写进日志。
 *
 * <p>它回答的是"人在哪里用、卡在哪一步"：站点来自扩展带来的请求头，
 * 结果取自响应状态（200 正常、422 内容不足、503 分析不可用、403 与 429 被挡）。
 * 分数与等级不在这里——那要读响应体，代价比这一行大得多，等有了"准不准"的反馈再说。
 *
 * <p>这一行里没有一处能还原用户在读什么：不记讨论内容，也不记页面地址，只有站点域名。
 *
 * <p>必须注册在准入与限流之前。拦截器只对已经通过 preHandle 的那些调用 afterCompletion，
 * 排在后面就会漏掉被挡下的请求，而"多少请求被挡"正是上线初期要看的东西。
 */
@Slf4j
@Component
public class UsageLogInterceptor implements HandlerInterceptor {

    /** 扩展带上来的站点域名。老版本扩展没有这个头，那时记成 unknown，也正好看出还有旧版本在跑。 */
    static final String SITE_HEADER = "X-Discussion-Site";

    private static final String UNKNOWN_SITE = "unknown";

    /** 站点只用于记账，超过这个长度的一律截断，免得有人拿它把日志撑爆。 */
    private static final int MAX_SITE_LENGTH = 64;

    /** 域名与端口允许出现的字符，其余一律丢掉：这个头是对外输入，不能让换行之类的东西混进日志。 */
    private static final Pattern SITE_ALLOWED = Pattern.compile("[^A-Za-z0-9.\\-:]");

    private static final String STARTED_AT_ATTRIBUTE = UsageLogInterceptor.class.getName() + ".startedAt";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute(STARTED_AT_ATTRIBUTE, System.nanoTime());
        return true;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception exception
    ) {
        log.info(
                "接口调用 站点={} 状态={} 耗时={}ms",
                siteOf(request),
                response.getStatus(),
                elapsedMillis(request)
        );
    }

    private static String siteOf(HttpServletRequest request) {
        String site = request.getHeader(SITE_HEADER);
        if (site == null) {
            return UNKNOWN_SITE;
        }

        String cleaned = SITE_ALLOWED.matcher(site).replaceAll("");
        if (cleaned.isEmpty()) {
            return UNKNOWN_SITE;
        }
        return cleaned.length() > MAX_SITE_LENGTH ? cleaned.substring(0, MAX_SITE_LENGTH) : cleaned;
    }

    private static long elapsedMillis(HttpServletRequest request) {
        Object startedAt = request.getAttribute(STARTED_AT_ATTRIBUTE);
        return startedAt instanceof Long start ? Duration.ofNanos(System.nanoTime() - start).toMillis() : -1L;
    }
}
