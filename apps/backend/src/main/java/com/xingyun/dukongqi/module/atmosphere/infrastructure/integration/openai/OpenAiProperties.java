package com.xingyun.dukongqi.module.atmosphere.infrastructure.integration.openai;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * OpenAI 兼容接口的连接配置。
 *
 * @param baseUrl 服务地址，指向兼容 OpenAI 协议的服务
 * @param apiKey  访问密钥，经环境变量注入，不写入仓库
 * @param model   使用的模型名
 * @param timeout 单次请求的超时时间，未配置时取默认值
 */
@ConfigurationProperties(prefix = "atmosphere.llm")
public record OpenAiProperties(String baseUrl, String apiKey, String model, Duration timeout) {
}
