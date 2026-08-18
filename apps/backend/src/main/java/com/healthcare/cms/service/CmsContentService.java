package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.healthcare.cms.dto.CmsContentRequest;
import com.healthcare.cms.dto.CmsContentResponse;
import com.healthcare.cms.dto.CmsContentHistoryResponse;
import com.healthcare.cms.dto.CmsRollbackRequest;
import com.healthcare.cms.entity.CmsComponentType;
import com.healthcare.cms.entity.CmsContent;
import com.healthcare.cms.entity.CmsContentChange;
import com.healthcare.cms.entity.CmsPublicationStatus;
import com.healthcare.cms.exception.CmsVersionConflictException;
import com.healthcare.cms.repository.CmsContentChangeRepository;
import com.healthcare.cms.repository.CmsContentRepository;
import org.springframework.data.domain.PageRequest;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
public class CmsContentService {

    private static final Pattern SLOT_KEY = Pattern.compile("[a-z0-9]+(?:[._-][a-z0-9]+)*");
    private static final int MAX_SLOT_KEY_LENGTH = 120;

    private final CmsContentRepository contentRepository;
    private final CmsContentChangeRepository changeRepository;
    private final CmsPayloadValidator payloadValidator;
    private final CmsPublishedContentCache cache;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    public CmsContentService(
        CmsContentRepository contentRepository,
        CmsContentChangeRepository changeRepository,
        CmsPayloadValidator payloadValidator,
        CmsPublishedContentCache cache,
        org.springframework.context.ApplicationEventPublisher eventPublisher
    ) {
        this.contentRepository = contentRepository;
        this.changeRepository = changeRepository;
        this.payloadValidator = payloadValidator;
        this.cache = cache;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public CmsContentResponse getPublished(String slotKey) {
        return getPublished(slotKey, null);
    }

    /**
     * Reads a published snapshot. A non-null feed cursor is an explicit
     * reconciliation read: bypass the local cache so a backend that missed a
     * Redis event cannot acknowledge a newer durable cursor with stale data.
     */
    @Transactional(readOnly = true)
    public CmsContentResponse getPublished(String slotKey, Long afterEventId) {
        String validatedSlotKey = validateSlotKey(slotKey);
        if (afterEventId != null) {
            if (afterEventId < 0L) {
                throw new com.healthcare.cms.exception.CmsPayloadValidationException(
                    "afterEventId must be a non-negative feed cursor"
                );
            }
        } else {
            CmsContentResponse cached = cache.get(validatedSlotKey);
            if (cached != null) {
                return cached;
            }
        }

        CmsPublishedContentCache.ReadToken readToken = cache.beginRead(validatedSlotKey);

        Optional<CmsContent> published = contentRepository.findBySlotKeyAndStatus(
                validatedSlotKey,
                CmsPublicationStatus.PUBLISHED
            );
        if (published.isEmpty()) {
            if (afterEventId != null) {
                // A forced read can prove an unpublish after this instance
                // missed Redis; do not let the old cache resurrect the slot.
                cache.evict(validatedSlotKey);
            }
            throw new ResourceNotFoundException("Published CMS content not found");
        }
        CmsContent content = published.get();
        CmsContentResponse response = toResponse(content);
        cache.put(readToken, response);
        return response;
    }

    @Transactional(readOnly = true)
    public List<CmsContentResponse> listPublished() {
        List<CmsContentResponse> responses = contentRepository
            .findByStatusOrderBySlotKeyAsc(CmsPublicationStatus.PUBLISHED)
            .stream()
            .map(this::toResponse)
            .toList();
        return responses;
    }

    @Transactional(readOnly = true)
    public CmsContentResponse getForAdmin(String slotKey) {
        CmsContent content = contentRepository.findBySlotKey(validateSlotKey(slotKey))
            .orElseThrow(() -> new ResourceNotFoundException("CMS content not found"));
        return toResponse(content);
    }

    @Transactional(readOnly = true)
    public List<CmsContentResponse> listForAdmin() {
        return contentRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional
    public CmsContentResponse upsert(String slotKey, CmsContentRequest request, UserDetails actor) {
        String validatedSlotKey = validateSlotKey(slotKey);
        JsonNode sanitizedPayload = payloadValidator.validateAndSanitize(request.componentType(), request.payload());
        long expectedVersion = request.expectedVersion();
        CmsContent existing = contentRepository.findBySlotKey(validatedSlotKey).orElse(null);
        boolean previouslyPublished = existing != null && existing.getStatus() == CmsPublicationStatus.PUBLISHED;
        JsonNode previousPayload = copy(existing == null ? null : existing.getPayload());

        if (existing == null) {
            if (expectedVersion != 0L) {
                throw new CmsVersionConflictException(validatedSlotKey, expectedVersion, 0L);
            }
            CmsContent created = new CmsContent();
            created.setSlotKey(validatedSlotKey);
            created.setComponentType(request.componentType());
            created.setPayload(sanitizedPayload);
            created.setStatus(request.status());
            created.setVersion(1L);
            OffsetDateTime now = now();
            created.setCreatedAt(now);
            created.setUpdatedAt(now);
            try {
                existing = contentRepository.saveAndFlush(created);
            } catch (DataIntegrityViolationException ex) {
                throw new DuplicateResourceException("CMS content slot already exists: " + validatedSlotKey);
            }
        } else {
            if (existing.getVersion() != expectedVersion) {
                throw new CmsVersionConflictException(validatedSlotKey, expectedVersion, existing.getVersion());
            }
            existing.setComponentType(request.componentType());
            existing.setPayload(sanitizedPayload);
            existing.setStatus(request.status());
            existing.setUpdatedAt(now());
            try {
                existing = contentRepository.saveAndFlush(existing);
            } catch (ObjectOptimisticLockingFailureException ex) {
                throw new CmsVersionConflictException(validatedSlotKey, expectedVersion, expectedVersion + 1L);
            }
        }

        boolean currentlyPublished = existing.getStatus() == CmsPublicationStatus.PUBLISHED;
        CmsContentChange change = new CmsContentChange();
        change.setContentId(existing.getId());
        change.setSlotKey(existing.getSlotKey());
        change.setContentVersion(existing.getVersion());
        change.setPublished(currentlyPublished);
        change.setPublicEvent(previouslyPublished || currentlyPublished);
        change.setActorEmail(actor == null ? "system" : actor.getUsername());
        change.setComponentType(existing.getComponentType());
        change.setStatus(existing.getStatus());
        change.setPayload(copy(existing.getPayload()));
        change.setPreviousPayload(previousPayload);
        change.setChangedAt(existing.getUpdatedAt());
        CmsContentChange savedChange = changeRepository.saveAndFlush(change);
        if (savedChange.isPublicEvent()) {
            eventPublisher.publishEvent(new CmsContentChangedEvent(
                savedChange.getId(),
                savedChange.getSlotKey(),
                savedChange.getContentVersion(),
                savedChange.isPublished(),
                savedChange.getChangedAt()
            ));
        }
        return toResponse(existing);
    }

    @Transactional(readOnly = true)
    public List<CmsContentHistoryResponse> history(String slotKey, int limit) {
        String validatedSlotKey = validateSlotKey(slotKey);
        int boundedLimit = Math.min(Math.max(limit, 1), 50);
        return changeRepository.findBySlotKeyOrderByIdDesc(validatedSlotKey, PageRequest.of(0, boundedLimit))
            .stream()
            .map(this::toHistoryResponse)
            .toList();
    }

    @Transactional
    public CmsContentResponse rollback(
        String slotKey,
        CmsRollbackRequest request,
        UserDetails actor
    ) {
        String validatedSlotKey = validateSlotKey(slotKey);
        CmsContentChange history = changeRepository.findByIdAndSlotKey(request.changeId(), validatedSlotKey)
            .orElseThrow(() -> new ResourceNotFoundException("CMS history entry not found"));
        if (history.getComponentType() == null || history.getStatus() == null || history.getPayload() == null) {
            throw new BusinessException(409, "History entry predates rollback snapshots");
        }

        CmsContentRequest restore = new CmsContentRequest(
            history.getComponentType(),
            copy(history.getPayload()),
            history.getStatus(),
            request.expectedVersion()
        );
        return upsert(validatedSlotKey, restore, actor);
    }

    private CmsContentHistoryResponse toHistoryResponse(CmsContentChange change) {
        return new CmsContentHistoryResponse(
            change.getId(),
            change.getSlotKey(),
            change.getComponentType(),
            change.getStatus(),
            copy(change.getPayload()),
            change.getContentVersion(),
            change.getActorEmail(),
            change.getChangedAt(),
            change.getComponentType() != null && change.getStatus() != null && change.getPayload() != null
        );
    }

    private JsonNode copy(JsonNode value) {
        return value == null ? null : value.deepCopy();
    }

    private CmsContentResponse toResponse(CmsContent content) {
        return new CmsContentResponse(
            content.getSlotKey(),
            content.getComponentType(),
            content.getPayload(),
            content.getStatus(),
            content.getVersion(),
            content.getUpdatedAt()
        );
    }

    private String validateSlotKey(String slotKey) {
        if (slotKey == null || slotKey.length() > MAX_SLOT_KEY_LENGTH || !SLOT_KEY.matcher(slotKey).matches()) {
            throw new com.healthcare.cms.exception.CmsPayloadValidationException(
                "slotKey must use lowercase letters, numbers, dots, dashes, or underscores"
            );
        }
        return slotKey;
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }
}
