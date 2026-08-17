package com.healthcare.cms.repository;

import com.healthcare.cms.entity.CmsContent;
import com.healthcare.cms.entity.CmsPublicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CmsContentRepository extends JpaRepository<CmsContent, UUID> {

    Optional<CmsContent> findBySlotKey(String slotKey);

    Optional<CmsContent> findBySlotKeyAndStatus(String slotKey, CmsPublicationStatus status);

    List<CmsContent> findByStatusOrderBySlotKeyAsc(CmsPublicationStatus status);
}
