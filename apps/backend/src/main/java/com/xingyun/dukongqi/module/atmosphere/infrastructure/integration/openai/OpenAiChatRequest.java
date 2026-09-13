package com.xingyun.dukongqi.module.atmosphere.infrastructure.integration.openai;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * OpenAI 兼容的对话补全请求体：仅存在于本包，不出现在其他层。
 */
public record OpenAiChatRequest(
        String model,
        List<Message> messages,
        double temperature,
        @JsonProperty("response_format") ResponseFormat responseFormat) {

    public record Message(String role, String content) {
    }

    public record ResponseFormat(String type) {
    }
}
