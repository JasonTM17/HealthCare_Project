package com.healthcare.ai.service;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.healthcare.ai.service.AiCatalogIndexService;
import com.healthcare.ai.service.AiService;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * After an ai-service restart its in-memory index is empty until the next
 * fixed-delay sync (up to 30 minutes), and every public question in that
 * window falls into the INSUFFICIENT_EVIDENCE fallback. The warm check must
 * push the catalog as soon as /health reports zero indexed documents.
 */
class AiCatalogIndexWarmCheckTest {

    private AiCatalogIndexService service(AiService aiService) {
        AiCatalogIndexService service = new AiCatalogIndexService(
            aiService,
            mock(SpecialtyRepository.class),
            mock(DoctorRepository.class),
            mock(ServiceRepository.class),
            mock(PackageRepository.class),
            mock(ArticleRepository.class),
            mock(FaqRepository.class),
            mock(JdbcTemplate.class)
        );
        ReflectionTestUtils.setField(service, "catalogSyncEnabled", true);
        return Mockito.spy(service);
    }

    @Test
    void pushesCatalogWhenHealthReportsAnEmptyIndex() {
        AiService aiService = mock(AiService.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);
        Map<String, Object> health = new HashMap<>();
        health.put("rag_documents", 0);
        when(aiService.probeHealth()).thenReturn(health);
        AiCatalogIndexService service = service(aiService);
        org.mockito.Mockito.doReturn(7).when(service).synchronizeCatalogNow();

        service.warmEmptyCatalogIndex();

        verify(service).synchronizeCatalogNow();
    }

    @Test
    void skipsWarmSyncWhenIndexAlreadyHasDocuments() {
        AiService aiService = mock(AiService.class);
        when(aiService.isRagIngestConfigured()).thenReturn(true);
        Map<String, Object> health = new HashMap<>();
        health.put("rag_documents", 181);
        when(aiService.probeHealth()).thenReturn(health);
        AiCatalogIndexService service = service(aiService);

        service.warmEmptyCatalogIndex();

        verify(service, never()).synchronizeCatalogNow();
    }

    @Test
    void skipsWarmSyncWhenCapabilityOrHealthProbeUnavailable() {
        AiService disabled = mock(AiService.class);
        when(disabled.isRagIngestConfigured()).thenReturn(false);
        AiCatalogIndexService disabledService = service(disabled);
        disabledService.warmEmptyCatalogIndex();
        verify(disabledService, never()).synchronizeCatalogNow();

        AiService unreachable = mock(AiService.class);
        when(unreachable.isRagIngestConfigured()).thenReturn(true);
        when(unreachable.probeHealth()).thenReturn(null);
        AiCatalogIndexService unreachableService = service(unreachable);
        unreachableService.warmEmptyCatalogIndex();
        verify(unreachableService, never()).synchronizeCatalogNow();
    }
}
