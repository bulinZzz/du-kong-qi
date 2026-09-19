package com.xingyun.dukongqi.shared.web;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web 边界的通用装配：把对外防线挂到配置好的路径上，另给隐私政策页一个短地址。
 *
 * <p>防线只挂在接口路径上，静态页之类不受限流影响。
 */
@Slf4j
@Configuration
public class WebConfiguration implements WebMvcConfigurer {

    private final ApiGuardInterceptor apiGuardInterceptor;
    private final ApiGuardProperties apiGuardProperties;

    WebConfiguration(ApiGuardInterceptor apiGuardInterceptor, ApiGuardProperties apiGuardProperties) {
        this.apiGuardInterceptor = apiGuardInterceptor;
        this.apiGuardProperties = apiGuardProperties;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        if (apiGuardProperties.paths().isEmpty()) {
            log.warn("api-guard.paths 为空：接口未受准入与限流保护");
            return;
        }
        registry.addInterceptor(apiGuardInterceptor).addPathPatterns(apiGuardProperties.paths());
    }

    /**
     * 隐私政策页另给一个不带扩展名的地址。
     *
     * <p>静态资源只按文件名匹配，`/privacy` 自己找不到文件。这个地址要填进应用商店、也会被人念、
     * 被人手抄，短一点更省事——转发本身没有业务含义，所以由配置承担。
     */
    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/privacy").setViewName("forward:/privacy.html");
    }
}
