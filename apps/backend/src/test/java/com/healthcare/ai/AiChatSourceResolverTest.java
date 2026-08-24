package com.healthcare.ai;

import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.ai.chat.service.AiChatSourceResolver;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Focused allowlist/CTA regression coverage for the Spring source authority. */
class AiChatSourceResolverTest {

    @Test
    void hospitalSupportRehydratesBranchIdentityAndBookingCta() {
        BranchRepository branches = mock(BranchRepository.class);
        SpecialtyRepository specialties = mock(SpecialtyRepository.class);
        DoctorRepository doctors = mock(DoctorRepository.class);
        ServiceRepository services = mock(ServiceRepository.class);
        PackageRepository packages = mock(PackageRepository.class);
        ArticleRepository articles = mock(ArticleRepository.class);
        FaqRepository faqs = mock(FaqRepository.class);
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches, specialties, doctors, services, packages, articles, faqs, jdbc);

        UUID id = UUID.randomUUID();
        Branch branch = new Branch();
        branch.setId(id);
        branch.setName("Cơ sở Quận 1");
        branch.setSlug("co-so-quan-1");
        branch.setActive(true);
        when(branches.findByIdAndActiveTrue(id)).thenReturn(Optional.of(branch));

        List<AiChatSourceResolver.ResolvedSource> sources = resolver.authorize(
            ChatMode.HOSPITAL_SUPPORT,
            List.of(Map.of("source_type", "branch", "source_id", id.toString(), "title", "AI title")));

        assertThat(sources).hasSize(1);
        assertThat(sources.get(0).title()).isEqualTo("Cơ sở Quận 1");
        assertThat(resolver.citations(sources).get(0))
            .containsEntry("projection_kind", "OPERATIONAL")
            .containsEntry("source_type", "branch")
            .doesNotContainKey("content_hash");
        assertThat(resolver.actions(sources)).containsExactly(
            Map.of("kind", "VIEW_SOURCE", "label", "Cơ sở Quận 1", "href", "/branches/co-so-quan-1"),
            Map.of("kind", "START_BOOKING", "label", "Đặt lịch", "href", "/dat-lich?branchId=" + id));
    }

    @Test
    void branchIsNotAClinicalSourceAndCannotBypassModePolicy() {
        BranchRepository branches = mock(BranchRepository.class);
        AiChatSourceResolver resolver = new AiChatSourceResolver(
            branches,
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class));

        UUID id = UUID.randomUUID();
        assertThat(resolver.authorize(
            ChatMode.HEALTH_EDUCATION,
            List.of(Map.of("source_type", "branch", "source_id", id.toString())))).isEmpty();
        verify(branches, never()).findByIdAndActiveTrue(id);
    }
}
