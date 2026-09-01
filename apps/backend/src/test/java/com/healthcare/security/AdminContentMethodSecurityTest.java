package com.healthcare.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import com.healthcare.cms.controller.AdminCmsContentController;
import com.healthcare.cms.service.CmsContentService;
import com.healthcare.hospital.controller.AdminArticleController;
import com.healthcare.hospital.service.AdminArticleService;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class AdminContentMethodSecurityTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void patientCannotInvokeAnyAdminArticleOrCmsMethod() {
        assertNonAdminCannotInvokeContentMethods("PATIENT");
    }

    @Test
    void doctorCannotInvokeAnyAdminArticleOrCmsMethod() {
        assertNonAdminCannotInvokeContentMethods("DOCTOR");
    }

    private void assertNonAdminCannotInvokeContentMethods(String role) {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext(TestConfig.class)) {
            SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                    role.toLowerCase(),
                    "not-used",
                    List.of(new SimpleGrantedAuthority("ROLE_" + role))
                )
            );

            AdminArticleController articles = context.getBean(AdminArticleController.class);
            AdminCmsContentController cms = context.getBean(AdminCmsContentController.class);

            assertDenied(() -> articles.list(Pageable.unpaged()));
            assertDenied(() -> articles.create(null, null));
            assertDenied(() -> articles.update("ak-security-fixture", null, null));
            assertDenied(() -> articles.delete("ak-security-fixture", null));

            assertDenied(cms::list);
            assertDenied(() -> cms.get("HOME_HERO"));
            assertDenied(() -> cms.upsert("HOME_HERO", null, null));
            assertDenied(() -> cms.history("HOME_HERO", 20));
            assertDenied(() -> cms.rollback("HOME_HERO", null, null));

            verifyNoInteractions(context.getBean(AdminArticleService.class));
            verifyNoInteractions(context.getBean(CmsContentService.class));
        }
    }

    private void assertDenied(ThrowingCall call) {
        assertThatThrownBy(call::invoke).isInstanceOf(AccessDeniedException.class);
    }

    @FunctionalInterface
    private interface ThrowingCall {
        void invoke();
    }

    @Configuration(proxyBeanMethods = false)
    @EnableMethodSecurity
    static class TestConfig {

        @Bean
        AdminArticleService adminArticleService() {
            return mock(AdminArticleService.class);
        }

        @Bean
        CmsContentService cmsContentService() {
            return mock(CmsContentService.class);
        }

        @Bean
        AdminArticleController adminArticleController(AdminArticleService service) {
            return new AdminArticleController(service);
        }

        @Bean
        AdminCmsContentController adminCmsContentController(CmsContentService service) {
            return new AdminCmsContentController(service);
        }
    }
}
