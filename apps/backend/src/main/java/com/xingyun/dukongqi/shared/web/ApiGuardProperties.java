package com.xingyun.dukongqi.shared.web;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * 对外接口的准入与限流配置。
 *
 * @param paths            对外接口的路径。准入、限流与用量记录都挂在这上面，其余路径（静态页等）不受影响
 * @param allowedOrigins   允许的请求来源；留空表示不校验来源（开发期如此）
 * @param perIpPerMinute   单个来源 IP 每分钟允许的请求数
 * @param dailyLimit       全部请求的每日上限，超出后不再受理——这是成本闸门
 */
@ConfigurationProperties(prefix = "api-guard")
public record ApiGuardProperties(
        List<String> paths,
        List<String> allowedOrigins,
        int perIpPerMinute,
        int dailyLimit
) {
}
