package com.healthcare.user.repository;

import com.healthcare.user.entity.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    @EntityGraph(attributePaths = {"roles", "roles.permissions"})
    Optional<User> findWithRolesByEmail(String email);

    @EntityGraph(attributePaths = {"roles", "roles.permissions"})
    Optional<User> findWithRolesById(UUID id);

    Optional<User> findByEmail(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.email = :email")
    Optional<User> findByEmailForUpdate(@Param("email") String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.googleSubject = :subject")
    Optional<User> findByGoogleSubjectForUpdate(@Param("subject") String subject);

    boolean existsByEmail(String email);

    /** Active shared demo personas (V70); non-demo deployments must have none. */
    long countByDemoTrueAndStatus(String status);

    /**
     * Ids of ACTIVE users holding the ADMIN role, capped by the caller's
     * page request so an admin fan-out (payment review, moderation) can never
     * grow unbounded.
     */
    @Query("select u.id from User u join u.roles r where r.code = 'ADMIN' and u.status = 'ACTIVE' order by u.id")
    List<UUID> findActiveAdminUserIds(Pageable pageable);

    /**
     * Admin account inventory. Roles are fetched lazily per row; callers that
     * need them on the returned page should batch-load via
     * {@link #findAllWithRolesByIdIn} to avoid an N+1 on the 20-30 row window.
     */
    @Query("select u from User u "
        + "where (:role is null or u.id in (select u2.id from User u2 join u2.roles r2 where r2.code = :role)) "
        + "and (:status is null or u.status = :status) "
        + "and (:q is null or lower(u.email) like :q escape '\\' or lower(u.displayName) like :q escape '\\')")
    Page<User> findForAdmin(
        @Param("role") String role,
        @Param("status") String status,
        @Param("q") String q,
        Pageable pageable);

    @EntityGraph(attributePaths = {"roles"})
    @Query("select u from User u where u.id in :ids")
    List<User> findAllWithRolesByIdIn(@Param("ids") java.util.Collection<UUID> ids);
}
