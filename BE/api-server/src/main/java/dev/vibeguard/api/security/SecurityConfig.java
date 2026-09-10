package dev.vibeguard.api.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

@Configuration
public class SecurityConfig {

    private final CustomOAuth2UserService oAuth2UserService;

    /**
     * 로그인 성공 후 이동할 URL. 기본값 "/"(prod: FE·BE 동일 오리진).
     * dev에서는 FE dev 서버가 별도 포트(:5173)이므로 .env의 POST_LOGIN_URI로
     * http://localhost:5173/dashboard 처럼 절대 URL을 지정한다.
     * 세션 쿠키는 host 기준(포트 무관)이라 :5173에서도 그대로 인증된다.
     */
    private final String postLoginUri;

    public SecurityConfig(
            CustomOAuth2UserService oAuth2UserService,
            @Value("${vibeguard.app.post-login-uri:/}") String postLoginUri) {
        this.oAuth2UserService = oAuth2UserService;
        this.postLoginUri = postLoginUri;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/", "/index.html", "/favicon.ico", "/error",
                    "/oauth2/**", "/login/**",
                    "/api/v1/auth/me",
                    "/actuator/health",
                    "/swagger-ui/**", "/v3/api-docs/**")
                .permitAll()
                .anyRequest().authenticated())
            .oauth2Login(oauth2 -> oauth2
                .userInfoEndpoint(userInfo -> userInfo.userService(oAuth2UserService))
                .defaultSuccessUrl(postLoginUri, true))
            .logout(logout -> logout
                .logoutUrl("/api/v1/auth/logout")
                .logoutSuccessHandler((request, response, authentication) ->
                    response.setStatus(HttpStatus.NO_CONTENT.value()))
                .deleteCookies("JSESSIONID"))
            // 미인증 API 요청은 302 리다이렉트 대신 401 반환
            .exceptionHandling(ex -> ex.authenticationEntryPoint(
                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            // 세션 쿠키 기반. 데모 단계라 CSRF는 비활성(추후 SameSite=Lax + CSRF 토큰 도입).
            .csrf(csrf -> csrf.disable());

        return http.build();
    }
}
