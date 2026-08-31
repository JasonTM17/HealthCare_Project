package com.healthcare.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.auth.security.BrowserCsrfFilter;
import com.healthcare.auth.security.BrowserSessionAuthenticationFilter;
import com.healthcare.auth.security.BffRequestVerifier;
import com.healthcare.exception.ApiError;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.time.Instant;
import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;
    private final Environment environment;
    private final RequestRateLimitFilter requestRateLimitFilter;
    private final BrowserSessionAuthenticationFilter browserSessionAuthenticationFilter;
    private final BrowserCsrfFilter browserCsrfFilter;
    private final com.healthcare.auth.security.BffRequiredFilter bffRequiredFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, ObjectMapper objectMapper, Environment environment,
            RequestRateLimitFilter requestRateLimitFilter,
            BrowserSessionAuthenticationFilter browserSessionAuthenticationFilter,
            BrowserCsrfFilter browserCsrfFilter,
            com.healthcare.auth.security.BffRequiredFilter bffRequiredFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.objectMapper = objectMapper;
        this.environment = environment;
        this.requestRateLimitFilter = requestRateLimitFilter;
        this.browserSessionAuthenticationFilter = browserSessionAuthenticationFilter;
        this.browserCsrfFilter = browserCsrfFilter;
        this.bffRequiredFilter = bffRequiredFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    ApiError error = new ApiError(
                        401,
                        HttpStatus.UNAUTHORIZED.getReasonPhrase(),
                        "Authentication required",
                        request.getRequestURI()
                    );
                    response.getWriter().write(objectMapper.writeValueAsString(error));
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    ApiError error = new ApiError(
                        403,
                        HttpStatus.FORBIDDEN.getReasonPhrase(),
                        "Access denied",
                        request.getRequestURI()
                    );
                    response.getWriter().write(objectMapper.writeValueAsString(error));
                })
            )
            .authorizeHttpRequests(auth -> auth
                .dispatcherTypeMatchers(DispatcherType.ERROR, DispatcherType.FORWARD).permitAll()
                .requestMatchers("/error").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(
                    "/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/refresh",
                    "/api/v1/auth/email-verifications/**", "/api/v1/auth/verify-email", "/api/v1/auth/confirm-email",
                    "/api/v1/auth/resend-verification", "/api/v1/auth/resend-email-verification",
                    "/api/v1/auth/password-reset-requests/**", "/api/v1/auth/forgot-password",
                    "/api/v1/auth/password-reset/**", "/api/v1/auth/reset-password/**"
                ).permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/browser-sessions").permitAll()
                .requestMatchers("/api/v1/health").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/payments/webhooks/bank-transfer").permitAll()
                .requestMatchers("/api/v1/hospital/**").permitAll()
                .requestMatchers("/api/v1/cms/**").permitAll()
                .requestMatchers("/api/v1/admin/cms/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/v1/careers/jobs/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/careers/jobs/*/applications").permitAll()
                .requestMatchers("/api/v1/admin/careers/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/v1/appointments/doctors/*/slots").permitAll()
                 .requestMatchers(HttpMethod.POST, "/api/v1/appointments/hold").permitAll()
                 .requestMatchers(HttpMethod.POST, "/api/v1/appointments/confirm").permitAll()
                 .requestMatchers(HttpMethod.POST, "/api/v1/appointments/*/otp/resend").permitAll()
                 .requestMatchers(HttpMethod.GET, "/api/v1/appointments/*").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/appointments/*/cancel").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/appointments/*/reschedule").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/public/specialty-recommendation").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/v1/public/ai/chat").permitAll()
                .requestMatchers("/api/v1/ai/**").authenticated()
                .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").hasRole("ADMIN")
                .requestMatchers("/api/v1/users/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(browserSessionAuthenticationFilter, JwtAuthenticationFilter.class)
            .addFilterAfter(browserCsrfFilter, BrowserSessionAuthenticationFilter.class)
            .addFilterBefore(requestRateLimitFilter, JwtAuthenticationFilter.class)
            .addFilterBefore(bffRequiredFilter, RequestRateLimitFilter.class);

        return http.build();
    }

    @Bean
    public FilterRegistrationBean<RequestRateLimitFilter> disableContainerRateLimitRegistration() {
        FilterRegistrationBean<RequestRateLimitFilter> registration = new FilterRegistrationBean<>(requestRateLimitFilter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public FilterRegistrationBean<com.healthcare.auth.security.BffRequiredFilter> disableContainerBffRequiredRegistration() {
        FilterRegistrationBean<com.healthcare.auth.security.BffRequiredFilter> registration =
            new FilterRegistrationBean<>(bffRequiredFilter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        String allowedOrigins = environment.getProperty("app.cors.allowed-origins", "");
        List<String> configuredOrigins = List.of(allowedOrigins.split(",")).stream()
            .map(String::trim)
            .filter(origin -> !origin.isEmpty())
            .toList();
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(configuredOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of(
            "Authorization", "Content-Type", "X-Requested-With", "Idempotency-Key", "X-CSRF-Token"
        ));
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(!configuredOrigins.isEmpty());
        configuration.setMaxAge(3600L);

        CorsConfiguration bearerMintDenied = new CorsConfiguration();
        bearerMintDenied.setAllowedOrigins(List.of());
        bearerMintDenied.setAllowedMethods(List.of());
        bearerMintDenied.setAllowedHeaders(List.of());
        bearerMintDenied.setAllowCredentials(false);

        return request -> BffRequestVerifier.isLegacyBearerMintRoute(
                request.getMethod(), request.getRequestURI())
            || (HttpMethod.OPTIONS.matches(request.getMethod())
                && BffRequestVerifier.isLegacyBearerMintRoute(
                    request.getHeader("Access-Control-Request-Method"),
                    request.getRequestURI()
                ))
            ? bearerMintDenied
            : configuration;
    }
}
