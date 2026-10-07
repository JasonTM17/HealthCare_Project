package com.healthcare.feedback;

import com.healthcare.exception.BusinessException;
import com.healthcare.feedback.dto.CreateFeedbackRequest;
import com.healthcare.feedback.dto.FeedbackItemResponse;
import com.healthcare.feedback.entity.FeedbackCategory;
import com.healthcare.feedback.entity.FeedbackStatus;
import com.healthcare.feedback.entity.UserFeedback;
import com.healthcare.feedback.repository.UserFeedbackRepository;
import com.healthcare.feedback.service.FeedbackService;
import com.healthcare.security.HealthcareUserPrincipal;
import com.healthcare.user.entity.Role;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FeedbackServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();

    private UserFeedbackRepository feedbackRepository;
    private UserRepository userRepository;
    private FeedbackService feedbackService;

    @BeforeEach
    void setUp() {
        feedbackRepository = Mockito.mock(UserFeedbackRepository.class);
        userRepository = Mockito.mock(UserRepository.class);
        feedbackService = new FeedbackService(feedbackRepository, userRepository);
    }

    @Test
    @DisplayName("Submit persists feedback owned by the authenticated principal, not a client-supplied id")
    void submitPersistsOwnedFeedback() {
        HealthcareUserPrincipal principal = principal("PATIENT");
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user()));
        when(feedbackRepository.countByUserIdAndCreatedAtAfter(eq(USER_ID), any(OffsetDateTime.class))).thenReturn(0L);
        when(feedbackRepository.save(any(UserFeedback.class))).thenAnswer(invocation -> {
            UserFeedback saved = invocation.getArgument(0);
            saved.setId(UUID.randomUUID());
            saved.setCreatedAt(OffsetDateTime.now());
            return saved;
        });

        FeedbackItemResponse response = feedbackService.submit(
            principal,
            new CreateFeedbackRequest(FeedbackCategory.BUG_REPORT, "  Nút đặt lịch lỗi  ", "  Nhấn nút đặt lịch nhưng trang không phản hồi.  "));

        ArgumentCaptor<UserFeedback> captor = ArgumentCaptor.forClass(UserFeedback.class);
        verify(feedbackRepository).save(captor.capture());
        UserFeedback persisted = captor.getValue();
        assertThat(persisted.getUser().getId()).isEqualTo(USER_ID);
        assertThat(persisted.getCategory()).isEqualTo(FeedbackCategory.BUG_REPORT);
        assertThat(persisted.getSubject()).isEqualTo("Nút đặt lịch lỗi");
        assertThat(persisted.getMessage()).isEqualTo("Nhấn nút đặt lịch nhưng trang không phản hồi.");
        assertThat(persisted.getStatus()).isEqualTo(FeedbackStatus.NEW);
        assertThat(response.status()).isEqualTo(FeedbackStatus.NEW);
    }

    @Test
    @DisplayName("Submit rejects the 11th feedback within 24 hours")
    void submitEnforcesDailyLimit() {
        HealthcareUserPrincipal principal = principal("PATIENT");
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user()));
        when(feedbackRepository.countByUserIdAndCreatedAtAfter(eq(USER_ID), any(OffsetDateTime.class))).thenReturn(10L);

        BusinessException ex = assertThrows(BusinessException.class, () -> feedbackService.submit(
            principal,
            new CreateFeedbackRequest(FeedbackCategory.GENERAL, "Tiêu đề", "Nội dung góp ý hợp lệ.")));
        assertThat(ex.getStatus()).isEqualTo(429);
        verify(feedbackRepository, never()).save(any());
    }

    @Test
    @DisplayName("Submit throws 401 when the account behind the token no longer exists")
    void submitRejectsMissingAccount() {
        HealthcareUserPrincipal principal = principal("PATIENT");
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> feedbackService.submit(
            principal,
            new CreateFeedbackRequest(FeedbackCategory.GENERAL, "Tiêu đề", "Nội dung góp ý hợp lệ.")));
        verify(feedbackRepository, never()).save(any());
    }

    @Test
    @DisplayName("List returns only the current account's feedback, newest first")
    void listMineScopesToPrincipal() {
        HealthcareUserPrincipal principal = principal("PATIENT");
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user()));

        UserFeedback item = new UserFeedback();
        item.setId(UUID.randomUUID());
        item.setCategory(FeedbackCategory.UI_UX);
        item.setSubject("Giao diện khó đọc");
        item.setMessage("Chữ phần đặt lịch hơi nhỏ trên điện thoại.");
        item.setStatus(FeedbackStatus.NEW);
        item.setCreatedAt(OffsetDateTime.now());
        when(feedbackRepository.findTop20ByUserIdOrderByCreatedAtDesc(USER_ID)).thenReturn(List.of(item));

        List<FeedbackItemResponse> items = feedbackService.listMine(principal);

        assertThat(items).hasSize(1);
        assertThat(items.get(0).subject()).isEqualTo("Giao diện khó đọc");
        verify(feedbackRepository).findTop20ByUserIdOrderByCreatedAtDesc(USER_ID);
    }

    private HealthcareUserPrincipal principal(String roleCode) {
        User user = user();
        Role role = new Role();
        role.setCode(roleCode);
        user.addRole(role);
        return HealthcareUserPrincipal.from(user);
    }

    private User user() {
        User user = new User();
        user.setId(USER_ID);
        user.setEmail("patient@example.com");
        user.setStatus("ACTIVE");
        return user;
    }
}
