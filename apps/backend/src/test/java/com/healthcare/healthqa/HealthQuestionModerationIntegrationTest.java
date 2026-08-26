package com.healthcare.healthqa;

import com.healthcare.exception.BusinessException;
import com.healthcare.hospital.entity.Faq;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class HealthQuestionModerationIntegrationTest {

    @Test
    void independentDoctorApprovalCreatesOnlyAnInactiveClinicalDraft() {
        var fixture = HealthQuestionDecisionTestSupport.fixture(false);

        fixture.approve();

        ArgumentCaptor<Faq> faqCaptor = ArgumentCaptor.forClass(Faq.class);
        verify(fixture.faqs()).saveAndFlush(faqCaptor.capture());
        Faq faq = faqCaptor.getValue();
        assertThat(faq.isActive()).isFalse();
        assertThat(faq.getPublishedAt()).isNull();
        assertThat(faq.getPublishedBy()).isNull();
        assertThat(faq.getCategory()).isEqualTo("Q&A");
        assertThat(faq.getTopicSlug()).isEqualTo("tim-mach");
        assertThat(faq.getOriginQuestionId()).isEqualTo(fixture.questionId());
        verify(fixture.revisions()).recordFaqFromDoctorReview(faq, fixture.reviewerId());
        assertThat(fixture.questionStatus()).isEqualTo("PUBLISHED");
        assertThat(fixture.answerStatus()).isEqualTo("APPROVED");
        assertThat(fixture.answerReviewer()).isEqualTo(fixture.reviewerId());
    }

    @Test
    void answerAuthorCannotApproveAndNoFaqIsMaterialized() {
        var fixture = HealthQuestionDecisionTestSupport.fixture(true);

        assertThatThrownBy(fixture::approve)
            .isInstanceOf(BusinessException.class)
            .extracting("code").isEqualTo("HEALTH_QUESTION_SELF_APPROVAL");

        verify(fixture.faqs(), never()).saveAndFlush(org.mockito.ArgumentMatchers.any());
        verify(fixture.revisions(), never()).recordFaqFromDoctorReview(
            org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        assertThat(fixture.questionStatus()).isEqualTo("ANSWER_SUBMITTED");
        assertThat(fixture.answerStatus()).isEqualTo("SUBMITTED");
    }

    @Test
    void revokeClosesQuestionAndUnpublishesMaterializedFaqThroughClinicalAuthority() {
        var fixture = HealthQuestionDecisionTestSupport.fixture(false);
        fixture.preparePublishedFaq();

        fixture.revoke();

        assertThat(fixture.questionStatus()).isEqualTo("CLOSED");
        assertThat(fixture.answerStatus()).isEqualTo("REVOKED");
        ArgumentCaptor<Faq> faqCaptor = ArgumentCaptor.forClass(Faq.class);
        verify(fixture.faqs()).saveAndFlush(faqCaptor.capture());
        assertThat(faqCaptor.getValue().isActive()).isFalse();
        assertThat(faqCaptor.getValue().getPublishedAt()).isNull();
        verify(fixture.revisions()).recordFaq(faqCaptor.getValue(), fixture.principal());
    }
}
