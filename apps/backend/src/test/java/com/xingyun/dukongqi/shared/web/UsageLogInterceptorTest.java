package com.xingyun.dukongqi.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * 用量记录那一行的形状：站点、状态、耗时，以及对外输入撑不坏这一行。
 *
 * <p>这一行是给人 grep 的，格式本身就是要守住的契约，所以连格式一起断言。
 */
class UsageLogInterceptorTest {

    private static final Logger USAGE_LOGGER = (Logger) LoggerFactory.getLogger(UsageLogInterceptor.class);

    private final ListAppender<ILoggingEvent> logged = new ListAppender<>();

    private final UsageLogInterceptor interceptor = new UsageLogInterceptor();

    @BeforeEach
    void attachLogCapture() {
        logged.start();
        USAGE_LOGGER.addAppender(logged);
    }

    @AfterEach
    void detachLogCapture() {
        USAGE_LOGGER.detachAppender(logged);
    }

    @Test
    @DisplayName("记下站点、状态与耗时")
    void records_site_status_and_time() {
        handle(request("www.bilibili.com"), 200);

        assertThat(line())
                .contains("站点=www.bilibili.com")
                .contains("状态=200")
                .containsPattern("耗时=\\d+ms");
    }

    @Test
    @DisplayName("没有站点头时记成 unknown")
    void falls_back_to_unknown_without_the_header() {
        handle(new MockHttpServletRequest(), 200);

        assertThat(line()).contains("站点=unknown");
    }

    @Test
    @DisplayName("站点里的可疑字符进不了日志")
    void does_not_let_a_forged_site_break_the_line() {
        handle(request("evil.com\n接口调用 站点=fake"), 200);

        assertThat(line()).contains("站点=evil.comfake").doesNotContain("\n");
        // 伪造的换行与汉字都被丢掉，那一行仍然只有一次"接口调用"
        assertThat(line()).containsOnlyOnce("接口调用");
    }

    @Test
    @DisplayName("过长的站点被截断")
    void truncates_a_long_site() {
        handle(request("a".repeat(200) + ".com"), 200);

        assertThat(line()).contains("站点=" + "a".repeat(64)).doesNotContain("a".repeat(65));
    }

    private void handle(MockHttpServletRequest request, int status) {
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(status);

        interceptor.preHandle(request, response, new Object());
        interceptor.afterCompletion(request, response, new Object(), null);
    }

    private String line() {
        assertThat(logged.list).hasSize(1);
        return logged.list.get(0).getFormattedMessage();
    }

    private static MockHttpServletRequest request(String site) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(UsageLogInterceptor.SITE_HEADER, site);
        return request;
    }
}
