package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.cms.entity.CmsContent;
import com.healthcare.cms.repository.CmsContentChangeRepository;
import com.healthcare.cms.repository.CmsContentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * HC-11: the admin CMS inventory is served in bounded, stably-ordered
 * windows instead of materializing every content row.
 */
class CmsContentServiceAdminListingTest {

    private CmsContentRepository contentRepository;
    private CmsContentService contentService;

    @BeforeEach
    void setUp() {
        contentRepository = Mockito.mock(CmsContentRepository.class);
        contentService = new CmsContentService(
            contentRepository,
            Mockito.mock(CmsContentChangeRepository.class),
            Mockito.mock(CmsPayloadValidator.class),
            Mockito.mock(CmsPublishedContentCache.class),
            Mockito.mock(JdbcTemplate.class),
            Mockito.mock(ApplicationEventPublisher.class)
        );
    }

    @Test
    @DisplayName("Defaults to a 500-row window ordered by slotKey when params absent")
    void defaultsToBoundedWindowOrderedBySlotKey() {
        when(contentRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        contentService.listForAdmin(null, null);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(contentRepository).findAll(pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize())
            .isEqualTo(CmsContentService.ADMIN_LISTING_DEFAULT_SIZE);
        assertThat(pageable.getValue().getSort().getOrderFor("slotKey")).isNotNull();
    }

    @Test
    @DisplayName("Oversized size clamps to the hard maximum of 1000")
    void clampsOversizedSize() {
        when(contentRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        contentService.listForAdmin(0, 99_999);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(contentRepository).findAll(pageable.capture());
        assertThat(pageable.getValue().getPageSize())
            .isEqualTo(CmsContentService.ADMIN_LISTING_MAX_SIZE);
    }

    @Test
    @DisplayName("Consecutive pages partition content without duplicates or gaps")
    void consecutivePagesAreStable() {
        CmsContent hero = content("home:hero");
        CmsContent about = content("about:intro");
        CmsContent contact = content("contact:card");
        when(contentRepository.findAll(any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(hero, about)))
            .thenReturn(new PageImpl<>(List.of(contact)));

        Page<com.healthcare.cms.dto.CmsContentResponse> pageZero = contentService.listForAdmin(0, 2);
        Page<com.healthcare.cms.dto.CmsContentResponse> pageOne = contentService.listForAdmin(1, 2);

        List<String> pageZeroSlots = pageZero.getContent()
            .stream().map(com.healthcare.cms.dto.CmsContentResponse::slotKey).toList();
        List<String> pageOneSlots = pageOne.getContent()
            .stream().map(com.healthcare.cms.dto.CmsContentResponse::slotKey).toList();
        assertThat(pageZeroSlots).containsExactly("home:hero", "about:intro");
        assertThat(pageOneSlots).containsExactly("contact:card");
        assertThat(java.util.Collections.disjoint(new java.util.HashSet<>(pageZeroSlots),
            new java.util.HashSet<>(pageOneSlots))).isTrue();
    }

    @Test
    @DisplayName("A window beyond the data returns an empty page")
    void emptyPageBeyondData() {
        when(contentRepository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        Page<com.healthcare.cms.dto.CmsContentResponse> page = contentService.listForAdmin(12, 500);

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isZero();
    }

    private CmsContent content(String slotKey) {
        CmsContent content = new CmsContent();
        content.setSlotKey(slotKey);
        content.setComponentType(com.healthcare.cms.entity.CmsComponentType.HERO);
        content.setPayload(new ObjectMapper().createObjectNode());
        content.setStatus(com.healthcare.cms.entity.CmsPublicationStatus.PUBLISHED);
        content.setVersion(1L);
        return content;
    }
}
