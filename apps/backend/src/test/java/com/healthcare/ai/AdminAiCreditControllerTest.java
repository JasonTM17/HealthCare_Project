package com.healthcare.ai;

import com.healthcare.ai.controller.AdminAiCreditController;
import com.healthcare.ai.controller.AdminAiCreditController.GrantCreditRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Contract tests for the admin AI-credit surface (A4).
 *
 * <p>Doctor AI credit was decided out of the product — the consumption path was
 * removed — so an admin grant to a doctor would mint a quota nothing can ever
 * spend. These tests pin the two halves of that decision: the request contract
 * refuses a DOCTOR target in the client's language, and the controller no
 * longer offers a doctor inventory at all. They fail the moment the capability
 * is quietly re-added.
 */
class AdminAiCreditControllerTest {

    private static ValidatorFactory validatorFactory;
    private static Validator validator;

    @BeforeAll
    static void createValidator() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        if (validatorFactory != null) {
            validatorFactory.close();
        }
    }

    @Test
    @DisplayName("A DOCTOR grant request fails validation with a Vietnamese explanation")
    void doctorGrantRequestIsRejected() {
        Set<ConstraintViolation<GrantCreditRequest>> violations = validator.validate(
            new GrantCreditRequest(UUID.randomUUID(), "DOCTOR", 50, "Cấp credit hỗ trợ lâm sàng"));

        assertThat(violations).singleElement().satisfies(violation -> {
            assertThat(violation.getPropertyPath()).hasToString("targetRole");
            assertThat(violation.getMessage()).contains("chỉ cấp credit AI cho bệnh nhân");
        });
    }

    @Test
    @DisplayName("A blank or unknown grant target is rejected, not silently ignored")
    void unknownGrantTargetIsRejected() {
        assertThat(validator.validate(
            new GrantCreditRequest(UUID.randomUUID(), "NURSE", 50, null)))
            .extracting(violation -> violation.getPropertyPath().toString())
            .containsExactly("targetRole");
        assertThat(validator.validate(
            new GrantCreditRequest(UUID.randomUUID(), "", 50, null)))
            .extracting(violation -> violation.getPropertyPath().toString())
            .contains("targetRole");
    }

    @Test
    @DisplayName("A PATIENT grant request still validates, so the paid quota path is intact")
    void patientGrantRequestIsAccepted() {
        assertThat(validator.validate(
            new GrantCreditRequest(UUID.randomUUID(), "PATIENT", 50, "Cấp thêm lượt hỏi AI")))
            .isEmpty();
    }

    @Test
    @DisplayName("The admin credit controller exposes no doctor listing endpoint")
    void controllerExposesNoDoctorListingRoute() {
        assertThat(Arrays.stream(AdminAiCreditController.class.getDeclaredMethods())
            .filter(method -> method.isAnnotationPresent(GetMapping.class))
            .flatMap(method -> Arrays.stream(method.getAnnotation(GetMapping.class).value()))
            .toList())
            .doesNotContain("/doctors");

        // The removed route's payload type must be gone too, otherwise the
        // capability can be re-exposed without touching this assertion.
        assertThat(Arrays.stream(AdminAiCreditController.class.getDeclaredMethods())
            .map(Method::getName))
            .doesNotContain("listDoctors");
    }
}
