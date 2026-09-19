package com.healthcare.ai.chat.service;

import com.healthcare.ai.chat.entity.ChatMode;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.BranchRepository;
import com.healthcare.hospital.repository.DoctorBranchRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiChatSourceResolverKnowledgeBridgeTest {

    private BranchRepository branchRepository;
    private SpecialtyRepository specialtyRepository;
    private DoctorRepository doctorRepository;
    private DoctorBranchRepository doctorBranchRepository;
    private ServiceRepository serviceRepository;
    private PackageRepository packageRepository;
    private ArticleRepository articleRepository;
    private FaqRepository faqRepository;
    private JdbcTemplate jdbc;
    private AiChatSourceResolver resolver;

    @BeforeEach
    void setUp() {
        branchRepository = mock(BranchRepository.class);
        specialtyRepository = mock(SpecialtyRepository.class);
        doctorRepository = mock(DoctorRepository.class);
        doctorBranchRepository = mock(DoctorBranchRepository.class);
        serviceRepository = mock(ServiceRepository.class);
        packageRepository = mock(PackageRepository.class);
        articleRepository = mock(ArticleRepository.class);
        faqRepository = mock(FaqRepository.class);
        jdbc = mock(JdbcTemplate.class);
        resolver = new AiChatSourceResolver(
            branchRepository, specialtyRepository, doctorRepository, doctorBranchRepository,
            serviceRepository, packageRepository, articleRepository, faqRepository, jdbc);
    }

    @Test
    void hospitalSupportResolvesSyntheticKnowledgeDocumentIds() {
        when(jdbc.queryForList(anyString(), eq("faq"), eq("faq-proc-02")))
            .thenReturn(List.of(Map.of(
                "title", "Cần chuẩn bị gì trước khi thực hiện nội soi dạ dày?",
                "content_hash", "abc123",
                "sync_revision", 7L)));

        AiChatSourceResolver.ResolvedSource resolved = resolver.resolve(
            ChatMode.HOSPITAL_SUPPORT, "faq", "faq-proc-02");

        assertThat(resolved).isNotNull();
        assertThat(resolved.type()).isEqualTo("faq");
        assertThat(resolved.id()).isEqualTo("faq-proc-02");
        assertThat(resolved.projectionKind()).isEqualTo("OPERATIONAL");
        assertThat(resolved.title()).contains("nội soi dạ dày");
        assertThat(resolved.contentRevision()).isEqualTo(7L);
        assertThat(resolved.contentHash()).isEqualTo("abc123");
    }

    @Test
    void hospitalSupportFailsClosedWhenKnowledgeRowIsMissing() {
        when(jdbc.queryForList(anyString(), eq("faq"), eq("faq-missing")))
            .thenReturn(List.of());

        assertThat(resolver.resolve(ChatMode.HOSPITAL_SUPPORT, "faq", "faq-missing"))
            .isNull();
    }

    @Test
    void hospitalSupportFailsClosedWhenKnowledgeLookupThrows() {
        when(jdbc.queryForList(anyString(), eq("article"), eq("bv-unknown")))
            .thenThrow(new RuntimeException("knowledge base unavailable"));

        assertThat(resolver.resolve(ChatMode.HOSPITAL_SUPPORT, "article", "bv-unknown"))
            .isNull();
    }

    @Test
    void educationModeKeepsUuidOnlyContract() {
        assertThat(resolver.resolve(ChatMode.HEALTH_EDUCATION, "faq", "faq-proc-02"))
            .isNull();
        verify(jdbc, never()).queryForList(anyString(), any(Object[].class));
    }

    @Test
    void hospitalSupportStillResolvesUuidCatalogSourcesThroughRepositories() {
        when(doctorRepository.findById(any(java.util.UUID.class)))
            .thenReturn(Optional.empty());

        assertThat(resolver.resolve(
            ChatMode.HOSPITAL_SUPPORT, "doctor", "0173904c-2da2-a7ed-9f28-7fcac8327dc9"))
            .isNull();
        verify(jdbc, never()).queryForList(anyString(), any(Object[].class));
    }
}
