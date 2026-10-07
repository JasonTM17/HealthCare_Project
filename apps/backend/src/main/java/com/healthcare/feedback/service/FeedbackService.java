package com.healthcare.feedback.service;

import com.healthcare.exception.BusinessException;
import com.healthcare.feedback.dto.CreateFeedbackRequest;
import com.healthcare.feedback.dto.FeedbackItemResponse;
import com.healthcare.feedback.entity.FeedbackStatus;
import com.healthcare.feedback.entity.UserFeedback;
import com.healthcare.feedback.repository.UserFeedbackRepository;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class FeedbackService {

    private static final Logger log = LoggerFactory.getLogger(FeedbackService.class);
    private static final int DAILY_FEEDBACK_LIMIT = 10;

    private final UserFeedbackRepository feedbackRepository;
    private final UserRepository userRepository;

    public FeedbackService(UserFeedbackRepository feedbackRepository, UserRepository userRepository) {
        this.feedbackRepository = feedbackRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public FeedbackItemResponse submit(UserDetails principal, CreateFeedbackRequest request) {
        User user = currentUser(principal);
        long today = feedbackRepository.countByUserIdAndCreatedAtAfter(
            user.getId(), OffsetDateTime.now().minusHours(24));
        if (today >= DAILY_FEEDBACK_LIMIT) {
            throw new BusinessException(429, "FEEDBACK_LIMIT_EXCEEDED",
                "Bạn đã gửi nhiều góp ý trong 24 giờ qua. Vui lòng thử lại sau.");
        }

        UserFeedback feedback = new UserFeedback();
        feedback.setUser(user);
        feedback.setCategory(request.category());
        feedback.setSubject(request.subject().trim());
        feedback.setMessage(request.message().trim());
        feedback.setStatus(FeedbackStatus.NEW);
        UserFeedback saved = feedbackRepository.save(feedback);

        log.info("user_feedback submitted id={} user={} category={}", saved.getId(), user.getId(), saved.getCategory());
        return toItem(saved);
    }

    @Transactional(readOnly = true)
    public List<FeedbackItemResponse> listMine(UserDetails principal) {
        User user = currentUser(principal);
        return feedbackRepository.findTop20ByUserIdOrderByCreatedAtDesc(user.getId())
            .stream().map(this::toItem).toList();
    }

    private User currentUser(UserDetails principal) {
        if (principal instanceof HealthcareUserPrincipal healthcarePrincipal) {
            UUID userId = healthcarePrincipal.getUserId();
            return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại hoặc đã bị vô hiệu hóa"));
        }
        return userRepository.findWithRolesByEmail(principal.getUsername())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không còn tồn tại hoặc đã bị vô hiệu hóa"));
    }

    private FeedbackItemResponse toItem(UserFeedback value) {
        // @CreationTimestamp only lands on flush; the just-saved entity can still
        // be null here even though the row already carries DEFAULT now().
        OffsetDateTime createdAt = value.getCreatedAt() != null ? value.getCreatedAt() : OffsetDateTime.now();
        return new FeedbackItemResponse(
            value.getId(),
            value.getCategory(),
            value.getSubject(),
            value.getMessage(),
            value.getStatus(),
            createdAt
        );
    }
}
