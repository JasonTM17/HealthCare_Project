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

    @Query("select c from CmsContentChange c where c.id > :afterId order by c.id asc")
    List<CmsContentChange> findAfterId(@Param("afterId") long afterId, Pageable pageable);

    Optional<CmsContentChange> findTopByOrderByIdDesc();
}
