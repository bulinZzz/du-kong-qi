package com.xingyun.dukongqi.module.atmosphere.infrastructure.integration.openai;

import java.util.List;

/**
 * OpenAI 兼容的对话补全响应体中本实现所关心的部分。
 */
public record OpenAiChatResponse(List<Choice> choices) {

    public record Choice(Message message) {
    }

    public record Message(String content) {
    }
}
