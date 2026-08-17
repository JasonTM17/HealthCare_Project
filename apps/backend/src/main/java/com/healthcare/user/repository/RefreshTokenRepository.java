package com.healthcare.user.repository;

import com.healthcare.user.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select rt from RefreshToken rt join fetch rt.user where rt.tokenHash = :tokenHash")
    Optional<RefreshToken> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    /**
     * Returns all non-revoked tokens for a given user. Used by logout and refresh-theft
     * revocation to avoid loading the entire refresh_tokens table.
     */
    @Query("select rt from RefreshToken rt where rt.user.id = :userId and rt.revokedAt is null")
    List<RefreshToken> findAllActiveByUserId(@Param("userId") UUID userId);

    /**
     * Bulk-delete all tokens owned by a user. Called during cascaded cleanup where
     * individual revocation timestamps are not required (e.g. user deletion).
     */
    @Modifying
    @Query("delete from RefreshToken rt where rt.user.id = :userId")
    void deleteAllByUserId(@Param("userId") UUID userId);
}
