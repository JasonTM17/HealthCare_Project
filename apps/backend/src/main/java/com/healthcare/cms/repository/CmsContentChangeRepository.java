package com.healthcare.cms.repository;

import com.healthcare.cms.entity.CmsContentChange;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CmsContentChangeRepository extends JpaRepository<CmsContentChange, Long> {

    @Query("select c from CmsContentChange c where c.id > :afterId and c.publicEvent = true order by c.id asc")
    List<CmsContentChange> findAfterId(@Param("afterId") long afterId, Pageable pageable);

    @Query("select c from CmsContentChange c where c.publicEvent = true order by c.id desc")
    Optional<CmsContentChange> findTopByOrderByIdDesc();

    List<CmsContentChange> findBySlotKeyOrderByIdDesc(String slotKey, Pageable pageable);

    Optional<CmsContentChange> findByIdAndSlotKey(Long id, String slotKey);
}
