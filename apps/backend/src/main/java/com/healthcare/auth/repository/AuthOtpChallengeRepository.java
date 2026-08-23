package com.healthcare.auth.repository;

import com.healthcare.auth.entity.AuthOtpChallenge;
import com.healthcare.auth.entity.AuthOtpPurpose;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuthOtpChallengeRepository extends JpaRepository<AuthOtpChallenge, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from AuthOtpChallenge c where c.user.id = :userId "
        + "and c.purpose = :purpose and c.consumedAt is null order by c.createdAt desc")
    List<AuthOtpChallenge> findActiveForUpdate(
        @Param("userId") UUID userId,
        @Param("purpose") AuthOtpPurpose purpose
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from AuthOtpChallenge c where c.user.id = :userId "
        + "and c.purpose = :purpose order by c.createdAt desc")
    List<AuthOtpChallenge> findLatestForUpdate(
        @Param("userId") UUID userId,
        @Param("purpose") AuthOtpPurpose purpose
    );

    default Optional<AuthOtpChallenge> findActiveLatestForUpdate(UUID userId, AuthOtpPurpose purpose) {
        return findActiveForUpdate(userId, purpose).stream().findFirst();
    }

    default Optional<AuthOtpChallenge> findLatestRecordForUpdate(UUID userId, AuthOtpPurpose purpose) {
        return findLatestForUpdate(userId, purpose).stream().findFirst();
    }
}
