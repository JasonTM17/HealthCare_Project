package com.healthcare.notification.repository;

import com.healthcare.notification.entity.NotificationPreference;
import com.healthcare.notification.entity.NotificationPreferenceId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, NotificationPreferenceId> {
    List<NotificationPreference> findByIdUserIdOrderByIdCategoryAscIdChannelAsc(UUID userId);

    /**
     * Idempotently materializes every category/channel pair for one account.
     * The database conflict target makes concurrent first reads safe and keeps
     * this path usable for users created after V45 without a trigger.
     */
    @Modifying
    @Query(value = """
        INSERT INTO notification_preferences (user_id, category, channel, enabled)
        SELECT :userId, categories.category, channels.channel,
               CASE WHEN categories.category = 'MARKETING' THEN FALSE ELSE TRUE END
        FROM (VALUES
            ('SECURITY'), ('APPOINTMENT'), ('PAYMENT'), ('CLINICAL_UPDATE'),
            ('CONSULTATION'), ('CARE_PLAN'), ('MARKETING')
        ) AS categories(category)
        CROSS JOIN (VALUES ('EMAIL'), ('IN_APP')) AS channels(channel)
        ON CONFLICT (user_id, category, channel) DO NOTHING
        """, nativeQuery = true)
    int ensureDefaults(@Param("userId") UUID userId);
}
