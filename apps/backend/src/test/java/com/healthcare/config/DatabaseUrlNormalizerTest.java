package com.healthcare.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.mock.env.MockEnvironment;

class DatabaseUrlNormalizerTest {

    @Test
    void convertsRenderUrlAndDropsUserInfo() {
        String result = DatabaseUrlNormalizer.normalize(
            "postgres://render_user:render_password@db.example.test:5432/healthcare?sslmode=require");

        assertThat(result)
            .isEqualTo("jdbc:postgresql://db.example.test:5432/healthcare?sslmode=require")
            .doesNotContain("render_user", "render_password");
    }

    @Test
    void preservesJdbcAndNonPostgresUrls() {
        assertThat(DatabaseUrlNormalizer.normalize("jdbc:postgresql://localhost:5432/healthcare"))
            .isEqualTo("jdbc:postgresql://localhost:5432/healthcare");
        assertThat(DatabaseUrlNormalizer.normalize("https://example.test/database"))
            .isEqualTo("https://example.test/database");
    }

    @Test
    void rejectsMalformedPostgresUrl() {
        assertThatThrownBy(() -> DatabaseUrlNormalizer.normalize("postgres://"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("DATABASE_URL is not a valid PostgreSQL URL");
    }

    @Test
    void rejectsCredentialQueryParametersBeforeTheyReachDatasource() {
        assertThatThrownBy(() -> DatabaseUrlNormalizer.normalize(
            "postgres://db.example.test/healthcare?password=secret"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("DATABASE_URL must not contain credential query parameters");

        assertThatThrownBy(() -> DatabaseUrlNormalizer.normalize(
            "postgres://db.example.test/healthcare?options=-c%20password%3Dsecret"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("DATABASE_URL must not contain credential query parameters");

        assertThatThrownBy(() -> DatabaseUrlNormalizer.normalize(
            "postgres://db.example.test/healthcare?sslpassword=secret"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("DATABASE_URL must not contain credential query parameters");
    }

    @Test
    void rejectsCredentialLikeAuthorityWithoutAHost() {
        assertThatThrownBy(() -> DatabaseUrlNormalizer.normalize(
            "postgres://user:password/healthcare"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("DATABASE_URL is not a valid PostgreSQL URL");
    }

    @Test
    void postProcessorSetsJdbcUrlWithoutLeakingCredentials() {
        MockEnvironment environment = new MockEnvironment()
            .withProperty("DATABASE_URL", "postgresql://user:secret@db.example.test/healthcare");

        new RenderDatabaseUrlEnvironmentPostProcessor()
            .postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getProperty("spring.datasource.url"))
            .isEqualTo("jdbc:postgresql://db.example.test/healthcare")
            .doesNotContain("secret");
    }

    @Test
    void explicitSpringDatasourceUrlWins() {
        MockEnvironment environment = new MockEnvironment()
            .withProperty("DATABASE_URL", "postgresql://user:secret@db.example.test/healthcare")
            .withProperty("spring.datasource.url", "jdbc:postgresql://override/healthcare");

        new RenderDatabaseUrlEnvironmentPostProcessor()
            .postProcessEnvironment(environment, new SpringApplication());

        assertThat(environment.getProperty("spring.datasource.url"))
            .isEqualTo("jdbc:postgresql://override/healthcare");
    }
}
