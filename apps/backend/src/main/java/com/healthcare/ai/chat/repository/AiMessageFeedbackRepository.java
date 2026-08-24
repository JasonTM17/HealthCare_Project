package com.healthcare.ai.chat.repository;

import com.healthcare.ai.chat.entity.AiMessageFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AiMessageFeedbackRepository extends JpaRepository<AiMessageFeedback, UUID> {
}
