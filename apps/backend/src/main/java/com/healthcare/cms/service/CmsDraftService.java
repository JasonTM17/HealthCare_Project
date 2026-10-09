package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.healthcare.cms.dto.CmsDraftRequest;
import com.healthcare.cms.dto.CmsDraftResponse;
import com.healthcare.cms.dto.CmsPublishRequest;
import com.healthcare.cms.dto.CmsRollbackRequest;
import com.healthcare.cms.entity.CmsComponentType;
import com.healthcare.cms.entity.CmsContent;
import com.healthcare.cms.entity.CmsContentChange;
import com.healthcare.cms.entity.CmsPublicationStatus;
import com.healthcare.cms.exception.CmsVersionConflictException;
import com.healthcare.cms.repository.CmsContentChangeRepository;
import com.healthcare.cms.repository.CmsContentRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Service
public class CmsDraftService {
    private final CmsContentRepository contents;
    private final CmsContentChangeRepository changes;
    private final CmsContentService legacy;
    private final CmsPayloadValidator legacyValidator;
    private final CmsPageLayoutValidator layoutValidator;
    private final CmsPageLayoutManifest manifest;
    private final CmsLayoutEntityResolver entities;
    private final ApplicationEventPublisher events;

    public CmsDraftService(CmsContentRepository contents, CmsContentChangeRepository changes,
            CmsContentService legacy, CmsPayloadValidator legacyValidator, CmsPageLayoutValidator layoutValidator,
            CmsPageLayoutManifest manifest, CmsLayoutEntityResolver entities, ApplicationEventPublisher events) {
        this.contents = contents; this.changes = changes; this.legacy = legacy; this.legacyValidator = legacyValidator;
        this.layoutValidator = layoutValidator; this.manifest = manifest; this.entities = entities; this.events = events;
    }

    @Transactional(readOnly = true)
    public CmsDraftResponse get(String slotKey) {
        legacy.validateSlotKey(slotKey);
        return response(contents.findBySlotKey(slotKey)
            .orElseThrow(() -> new ResourceNotFoundException("CMS content not found")));
    }

    @Transactional
    public CmsDraftResponse save(String slotKey, CmsDraftRequest request, UserDetails actor) {
        legacy.validateSlotKey(slotKey);
        legacy.validateSlotComponent(slotKey, request.componentType());
        JsonNode payload = validatePayload(slotKey, request.componentType(), request.payload());
        legacy.lockPublicationCursor();
        validateEntity(slotKey);
        CmsContent content = contents.findBySlotKey(slotKey).orElse(null);
        checkVersion(slotKey, request.expectedVersion(), content);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        JsonNode previous = content == null ? null : copy(content.getDraftPayload() == null ? content.getPayload() : content.getDraftPayload());
        if (content == null) {
            content = new CmsContent();
            content.setSlotKey(slotKey); content.setVersion(1L);
            content.setComponentType(request.componentType()); content.setPayload(copy(payload));
            content.setStatus(CmsPublicationStatus.DRAFT); content.setCreatedAt(now); content.setUpdatedAt(now);
        } else if (content.getStatus() == CmsPublicationStatus.PUBLISHED && content.getPublicRevision() == null) {
            // Operational inserts predating metadata are frozen before their first private edit.
            content.setPublicRevision(content.getVersion()); content.setPublicUpdatedAt(content.getUpdatedAt());
        }
        content.setDraftComponentType(request.componentType()); content.setDraftPayload(copy(payload)); content.setDraftUpdatedAt(now);
        content = contents.saveAndFlush(content);
        recordChange(content, request.componentType(), payload, previous, false, now, actor);
        return response(content);
    }

    @Transactional
    public CmsDraftResponse publish(String slotKey, CmsPublishRequest request, UserDetails actor) {
        legacy.validateSlotKey(slotKey);
        legacy.lockPublicationCursor();
        CmsContent content = contents.findBySlotKey(slotKey)
            .orElseThrow(() -> new ResourceNotFoundException("CMS content not found"));
        checkVersion(slotKey, request.expectedVersion(), content);
        if (content.getDraftPayload() == null) throw new BusinessException(409, "There is no saved draft to publish");
        legacy.validateSlotComponent(slotKey, content.getDraftComponentType());
        JsonNode payload = validatePayload(slotKey, content.getDraftComponentType(), content.getDraftPayload());
        validateEntity(slotKey);
        JsonNode previous = copy(content.getPayload());
        long publicRevision = content.getVersion() + 1L;
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        content.setComponentType(content.getDraftComponentType()); content.setPayload(payload);
        content.setStatus(CmsPublicationStatus.PUBLISHED); content.setUpdatedAt(now);
        content.setPublicRevision(publicRevision); content.setPublicUpdatedAt(now); content.clearDraft();
        content = contents.saveAndFlush(content);
        if (content.getVersion() != publicRevision) throw new BusinessException(409, "CMS publication version changed");
        CmsContentChange change = recordChange(content, content.getComponentType(), payload, previous, true, now, actor);
        events.publishEvent(new CmsContentChangedEvent(change.getId(), slotKey, publicRevision, true, now));
        return response(content);
    }

    @Transactional
    public CmsDraftResponse restore(String slotKey, CmsRollbackRequest request, UserDetails actor) {
        legacy.validateSlotKey(slotKey);
        CmsContentChange history = changes.findByIdAndSlotKey(request.changeId(), slotKey)
            .orElseThrow(() -> new ResourceNotFoundException("CMS history entry not found"));
        if (history.getComponentType() == null || history.getPayload() == null) {
            throw new BusinessException(409, "History entry predates rollback snapshots");
        }
        return save(slotKey, new CmsDraftRequest(history.getComponentType(), copy(history.getPayload()), request.expectedVersion()), actor);
    }

    private JsonNode validatePayload(String slotKey, CmsComponentType type, JsonNode payload) {
        return type == CmsComponentType.PAGE_LAYOUT ? layoutValidator.validateAndSanitize(slotKey, payload)
            : legacyValidator.validateAndSanitize(type, payload);
    }

    private void validateEntity(String slotKey) {
        if (CmsPublicSlotKeys.isLayout(slotKey)) entities.requirePublicEntity(manifest.resolve(slotKey));
    }

    private void checkVersion(String slotKey, long expected, CmsContent content) {
        long current = content == null ? 0L : content.getVersion();
        if (expected != current) throw new CmsVersionConflictException(slotKey, expected, current);
    }

    private CmsContentChange recordChange(CmsContent content, CmsComponentType type, JsonNode payload,
            JsonNode previous, boolean published, OffsetDateTime now, UserDetails actor) {
        CmsContentChange change = new CmsContentChange();
        change.setContentId(content.getId()); change.setSlotKey(content.getSlotKey()); change.setContentVersion(content.getVersion());
        change.setPublished(published); change.setPublicEvent(published);
        change.setComponentType(type); change.setStatus(published ? CmsPublicationStatus.PUBLISHED : CmsPublicationStatus.DRAFT);
        change.setPayload(copy(payload)); change.setPreviousPayload(previous); change.setChangedAt(now);
        change.setActorEmail(actor == null ? "system" : actor.getUsername());
        return changes.saveAndFlush(change);
    }

    private CmsDraftResponse response(CmsContent content) {
        boolean draft = content.getDraftPayload() != null;
        return new CmsDraftResponse(content.getSlotKey(), content.getVersion(), draft,
            draft ? content.getDraftComponentType() : content.getComponentType(),
            draft ? content.getDraftPayload() : content.getPayload(), content.getDraftUpdatedAt(),
            content.getStatus() == CmsPublicationStatus.PUBLISHED ? legacy.toPublishedResponse(content) : null);
    }

    private JsonNode copy(JsonNode payload) { return payload == null ? null : payload.deepCopy(); }
}
