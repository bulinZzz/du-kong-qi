package com.xingyun.dukongqi.module.atmosphere.infrastructure.integration.openai;

import com.xingyun.dukongqi.module.atmosphere.api.AnalysisUnavailableException;
import com.xingyun.dukongqi.module.atmosphere.api.InsufficientContentException;
import com.xingyun.dukongqi.module.atmosphere.application.port.AtmosphereAnalyzer;
import com.xingyun.dukongqi.module.atmosphere.domain.model.AtmosphereAnalysis;
import com.xingyun.dukongqi.module.atmosphere.domain.model.FlameIntensity;
import com.xingyun.dukongqi.shared.util.StringUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Objects;

/**
 * OpenAI 兼容接口的分析实现。
 *
 * <p>本类是模型输出的进入边界：承担协议适配与结果翻译。连接失败、超时、响应结构不符，
 * 以及取值越界等无法形成有效分析的情况，统一翻译为分析不可用；技术细节只留在日志中。
 */
@Component
public class OpenAiAtmosphereAnalyzer implements AtmosphereAnalyzer {

    private static final String CHAT_COMPLETIONS_PATH = "/chat/completions";
    private static final String JSON_RESPONSE_TYPE = "json_object";
    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(30);

    /**
     * 评分需要稳定可复现，因此不引入采样随机性。
     */
    private static final double TEMPERATURE = 0;

    private final OpenAiProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public OpenAiAtmosphereAnalyzer(OpenAiProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;

        String baseUrl = Objects.requireNonNull(
                properties.baseUrl(), "atmosphere.llm.base-url 未配置");
        Duration timeout = properties.timeout() == null ? DEFAULT_TIMEOUT : properties.timeout();

        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(timeout).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(timeout);

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    @Override
    public AtmosphereAnalysis analyze(String content) {
        if (StringUtils.isBlank(properties.apiKey())) {
            throw new AnalysisUnavailableException("未配置模型访问密钥");
        }
        return toAnalysis(requestCompletion(content));
    }

    private OpenAiChatResponse requestCompletion(String content) {
        OpenAiChatRequest request = new OpenAiChatRequest(
                properties.model(),
                List.of(
                        new OpenAiChatRequest.Message("system", FlameIntensityPrompt.SYSTEM),
                        new OpenAiChatRequest.Message("user", FlameIntensityPrompt.user(content))),
                TEMPERATURE,
                new OpenAiChatRequest.ResponseFormat(JSON_RESPONSE_TYPE));
        try {
            return restClient.post()
                    .uri(CHAT_COMPLETIONS_PATH)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(OpenAiChatResponse.class);
        } catch (RestClientException exception) {
            throw new AnalysisUnavailableException("调用模型失败", exception);
        }
    }

    AtmosphereAnalysis toAnalysis(OpenAiChatResponse response) {
        String content = messageContent(response);
        if (StringUtils.isBlank(content)) {
            throw new AnalysisUnavailableException("模型未返回分析内容");
        }

        AnalysisPayload payload = readPayload(content);
        if (Boolean.TRUE.equals(payload.insufficientContent())) {
            throw new InsufficientContentException("页面内容不足以分析");
        }
        try {
            return new AtmosphereAnalysis(
                    new FlameIntensity(requireField(payload.flameIntensity(), "flameIntensity")),
                    requireField(payload.summary(), "summary"),
                    requireField(payload.evidence(), "evidence"),
                    requireField(payload.confidence(), "confidence"));
        } catch (IllegalArgumentException exception) {
            throw new AnalysisUnavailableException("模型返回的结果不符合约定", exception);
        }
    }

    private static String messageContent(OpenAiChatResponse response) {
        if (response == null || response.choices() == null || response.choices().isEmpty()) {
            return null;
        }
        OpenAiChatResponse.Choice choice = response.choices().get(0);
        if (choice == null || choice.message() == null) {
            return null;
        }
        return choice.message().content();
    }

    private AnalysisPayload readPayload(String content) {
        try {
            return objectMapper.readValue(content, AnalysisPayload.class);
        } catch (JacksonException exception) {
            throw new AnalysisUnavailableException("模型返回内容无法解析", exception);
        }
    }

    private static <T> T requireField(T value, String field) {
        if (value == null) {
            throw new AnalysisUnavailableException("模型返回结果缺少字段：" + field);
        }
        return value;
    }

    /**
     * 模型输出的原始结构：字段允许缺失或越界，是否可用由领域模型判定；
     * 模型拒绝判断时只给出 {@code insufficientContent}。
     */
    public record AnalysisPayload(
            Integer flameIntensity,
            String summary,
            List<String> evidence,
            Double confidence,
            Boolean insufficientContent) {
    }
}
