package com.healthcare.user.repository;

import com.healthcare.user.entity.UserPreferences;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserPreferencesRepository extends JpaRepository<UserPreferences, UUID> {

    @Query("select p from UserPreferences p where p.user.id = :userId")
    Optional<UserPreferences> findByUserId(@Param("userId") UUID userId);
}
