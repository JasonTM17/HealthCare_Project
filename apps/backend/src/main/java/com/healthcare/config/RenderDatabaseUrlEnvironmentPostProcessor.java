package com.healthcare.config;

import java.util.Map;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.PropertySource;

/**
 * Normalizes Render's provider connection string before Spring Boot creates a
 * DataSource. This is intentionally limited to DATABASE_URL and leaves an
 * explicit SPRING_DATASOURCE_URL override authoritative.
 */
public final class RenderDatabaseUrlEnvironmentPostProcessor
        implements EnvironmentPostProcessor, Ordered {

    private static final String DATABASE_URL = "DATABASE_URL";
    private static final String EXPLICIT_DATASOURCE_URL = "SPRING_DATASOURCE_URL";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (hasExplicitDatasourceUrl(environment)) {
            return;
        }
        String rawUrl = environment.getProperty(DATABASE_URL);
        if (rawUrl == null || rawUrl.isBlank()) {
            return;
        }
        final String normalized;
        try {
            normalized = DatabaseUrlNormalizer.normalize(rawUrl);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("DATABASE_URL must be a valid PostgreSQL connection string", ex);
        }
        if (!rawUrl.equals(normalized)) {
            environment.getPropertySources().addFirst(new MapPropertySource(
                "renderDatabaseUrlNormalization",
                Map.of("spring.datasource.url", normalized)));
        }
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    private boolean hasExplicitDatasourceUrl(ConfigurableEnvironment environment) {
        for (PropertySource<?> source : environment.getPropertySources()) {
            if (source.containsProperty(EXPLICIT_DATASOURCE_URL)) {
                return true;
            }
            // Command-line/test property sources commonly use the relaxed
            // lower-case spelling. Do not treat application.yml itself as an
            // explicit override because it contains the DATABASE_URL fallback.
            if (!source.getName().startsWith("applicationConfig")
                    && source.containsProperty("spring.datasource.url")) {
                return true;
            }
        }
        return false;
    }
}
