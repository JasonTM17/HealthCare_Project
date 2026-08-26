package com.healthcare.auth.repository;

import com.healthcare.auth.entity.BrowserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface BrowserSessionRepository extends JpaRepository<BrowserSession, UUID> {

    @Query("select bs from BrowserSession bs where bs.user.id = :userId order by bs.createdAt desc")
    List<BrowserSession> findAllByUserId(@Param("userId") UUID userId);
}
