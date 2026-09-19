package com.xingyun.dukongqi.shared.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.xingyun.dukongqi.module.atmosphere.application.port.AtmosphereAnalyzer;
import com.xingyun.dukongqi.module.atmosphere.domain.model.AtmosphereAnalysis;
import com.xingyun.dukongqi.module.atmosphere.domain.model.FlameIntensity;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

/**
 * 对外防线在 HTTP 边界上的表现：拦得住、放得行，且拒绝时不把对方送来的来源回显出去。
 *
 * <p>判断逻辑本身由 {@link ApiGuardInterceptorTest} 覆盖，这里只验证它挂上了、翻译成了正确状态码。
 */
@SpringBootTest(properties = "api-guard.allowed-origins[0]=chrome-extension://abcdefghijklmnopabcdefghijklmnop")
class ApiGuardWebTest {

    private static final String EXTENSION_ORIGIN = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

    private static final String LONG_TEXT = "这里是一段足够长的页面文本。".repeat(30);

    private static final Logger USAGE_LOGGER = (Logger) LoggerFactory.getLogger(UsageLogInterceptor.class);

    private final WebApplicationContext context;

    private final ListAppender<ILoggingEvent> logged = new ListAppender<>();

    private MockMvc mockMvc;

    @MockitoBean
    private AtmosphereAnalyzer atmosphereAnalyzer;

    @Autowired
    ApiGuardWebTest(WebApplicationContext context) {
        this.context = context;
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        logged.start();
        USAGE_LOGGER.addAppender(logged);
    }

    @AfterEach
    void detachLogCapture() {
        USAGE_LOGGER.detachAppender(logged);
    }

    @Test
    @DisplayName("来源在名单内照常分析")
    void analyze_should_pass_for_the_allowed_origin() throws Exception {
        given(atmosphereAnalyzer.analyze(anyString()))
                .willReturn(new AtmosphereAnalysis(
                        new FlameIntensity(52),
                        "争论明显",
                        List.of("出现讽刺"),
                        0.8));

        mockMvc.perform(analysis().header(HttpHeaders.ORIGIN, EXTENSION_ORIGIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flameIntensity").value(52));
    }

    @Test
    @DisplayName("来源不在名单内返回 403，且不回显对方送来的来源")
    void analyze_should_return_403_for_another_origin() throws Exception {
        mockMvc.perform(analysis().header(HttpHeaders.ORIGIN, "https://example.com"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.title").value("Forbidden"))
                .andExpect(jsonPath("$.detail").value("请求来源不被允许"))
                .andExpect(result -> assertThat(result.getResponse().getContentAsString())
                        .doesNotContain("example.com"));
    }

    @Test
    @DisplayName("没有来源头返回 403")
    void analyze_should_return_403_without_origin() throws Exception {
        mockMvc.perform(analysis())
                .andExpect(status().isForbidden());
    }

    /**
     * 用量记录必须排在准入与限流之前，否则被挡下的请求不会留下任何痕迹——
     * 而"有多少请求被挡"正是上线初期要看的东西。
     */
    @Test
    @DisplayName("被挡下的请求也会留下用量记录")
    void rejected_request_is_still_recorded() throws Exception {
        mockMvc.perform(analysis()
                        .header(HttpHeaders.ORIGIN, "https://example.com")
                        .header(UsageLogInterceptor.SITE_HEADER, "www.bilibili.com"))
                .andExpect(status().isForbidden());

        assertThat(logged.list).hasSize(1);
        assertThat(logged.list.get(0).getFormattedMessage())
                .contains("站点=www.bilibili.com")
                .contains("状态=403");
    }

    private static MockHttpServletRequestBuilder analysis() {
        return post("/atmosphere/analysis")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "text": "%s"
                        }
                        """.formatted(LONG_TEXT));
    }
}
