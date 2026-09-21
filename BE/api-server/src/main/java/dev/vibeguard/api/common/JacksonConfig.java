package dev.vibeguard.api.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * ObjectMapper 빈 보장.
 * Boot 4 구성에서 Jackson 자동구성이 잡히지 않는 경우가 있어, 없을 때만 명시 등록한다.
 * (RunnerCallbackController/RunnerClient가 ObjectMapper를 주입받는다.)
 */
@Configuration
public class JacksonConfig {

    @Bean
    @ConditionalOnMissingBean
    ObjectMapper objectMapper() {
        return JsonMapper.builder().build();
    }
}
