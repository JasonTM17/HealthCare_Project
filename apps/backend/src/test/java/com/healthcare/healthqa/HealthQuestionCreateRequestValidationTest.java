package com.healthcare.healthqa;

import com.healthcare.healthqa.dto.HealthQuestionContracts;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The public alias is mirrored by ck_health_questions_public_alias in DDL
 * (ASCII-safe). Bean validation must reject unsafe aliases with a clear 400
 * before they reach the database as an opaque integrity-violation 409.
 */
class HealthQuestionCreateRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private HealthQuestionContracts.CreateRequest request(String alias) {
        return new HealthQuestionContracts.CreateRequest(
            "tim-mach", "Huyết áp 135/85 có cần đo tại nhà không ạ?", alias);
    }

    @Test
    void asciiAliasIsValid() {
        assertThat(validator.validate(request("Benh nhan 01"))).isEmpty();
        assertThat(validator.validate(request("Mai-T"))).isEmpty();
    }

    @Test
    void vietnameseDiacriticAliasIsRejectedWithClearMessage() {
        var violations = validator.validate(request("Mai An Tâm"));
        assertThat(violations).anySatisfy(v ->
            assertThat(v.getMessage()).contains("Biệt danh chỉ gồm chữ không dấu"));
    }

    @Test
    void tooShortOrSymbolLeadingAliasIsRejected() {
        assertThat(validator.validate(request("ab"))).isNotEmpty();
        assertThat(validator.validate(request("-abc"))).isNotEmpty();
    }

    @Test
    void trailingNewlineAliasIsRejected() {
        // Java $ would match before a trailing newline while PostgreSQL $ does
        // not; \\z keeps bean validation aligned with the DDL check.
        assertThat(validator.validate(request("abc\n"))).isNotEmpty();
    }
}
