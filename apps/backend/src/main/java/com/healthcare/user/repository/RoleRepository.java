package com.healthcare.user.repository;

import com.healthcare.user.entity.Role;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoleRepository extends JpaRepository<Role, UUID> {

    Optional<Role> findByCode(String code);

    boolean existsByCode(String code);

    /**
     * Sentinel lock for account-governance mutations. The ADMIN role row is a
     * stable shared row every "who is an active admin" decision passes
     * through; locking it serializes last-admin invariants without locking
     * the (constantly changing) admin set itself.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Role r where r.code = :code")
    Optional<Role> findByCodeForUpdate(@Param("code") String code);
}
