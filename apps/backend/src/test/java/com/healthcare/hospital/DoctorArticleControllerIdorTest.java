package com.healthcare.hospital;

import com.healthcare.exception.ForbiddenException;
import com.healthcare.hospital.controller.DoctorArticleController;
import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.hospital.service.AdminArticleService;
import com.healthcare.hospital.service.ArticleService;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class DoctorArticleControllerIdorTest {

    private AdminArticleService adminArticleService;
    private ArticleService articleService;
    private ArticleRepository articleRepository;
    private DoctorRepository doctorRepository;
    private UserRepository userRepository;
    private DoctorArticleController controller;

    private User doctorUser;
    private Doctor doctor;
    private UserDetails doctorActor;

    @BeforeEach
    void setUp() {
        adminArticleService = Mockito.mock(AdminArticleService.class);
        articleService = Mockito.mock(ArticleService.class);
        articleRepository = Mockito.mock(ArticleRepository.class);
        doctorRepository = Mockito.mock(DoctorRepository.class);
        userRepository = Mockito.mock(UserRepository.class);

        controller = new DoctorArticleController(
            adminArticleService,
            articleService,
            articleRepository,
            doctorRepository,
            userRepository
        );

        UUID userId = UUID.randomUUID();
        doctorUser = new User();
        doctorUser.setId(userId);
        doctorUser.setEmail("doctor.khoi@healthcare.com");
        doctorUser.setDisplayName("Nguyễn Minh Khôi");

        doctor = new Doctor();
        doctor.setId(UUID.randomUUID());
        doctor.setUserId(userId);
        doctor.setFullName("TS.BS Nguyễn Minh Khôi");

        doctorActor = new org.springframework.security.core.userdetails.User(
            "doctor.khoi@healthcare.com",
            "password",
            List.of(new SimpleGrantedAuthority("ROLE_DOCTOR"))
        );

        when(userRepository.findByEmail("doctor.khoi@healthcare.com")).thenReturn(Optional.of(doctorUser));
        when(doctorRepository.findByUserId(userId)).thenReturn(Optional.of(doctor));
    }

    @Test
    @DisplayName("Doctor cannot edit article of another author (IDOR / BOLA rejected with 403 Forbidden)")
    void cannotEditOtherDoctorArticle() {
        Article otherArticle = new Article();
        otherArticle.setSlug("bai-viet-nguoi-khac");
        otherArticle.setTitle("Bài viết người khác");
        otherArticle.setAuthorName("BS.CKII Võ Thị Mai");

        when(articleRepository.findBySlug("bai-viet-nguoi-khac")).thenReturn(Optional.of(otherArticle));

        ArticleRequest request = new ArticleRequest(
            "Cố ý chỉnh sửa bài viết khác", "bai-viet-nguoi-khac", "Tóm tắt", "Nội dung",
            "Tim mạch", "BS.CKII Võ Thị Mai", 5, "tim-mach", "GENERAL", null,
            null, null, null, null, null, null, "vi", "GENERAL", null, null, null, null, null, null, null, null, false, true
        );

        ForbiddenException ex = assertThrows(ForbiddenException.class, () ->
            controller.updateArticle("bai-viet-nguoi-khac", request, doctorActor)
        );
        assertTrue(ex.getMessage().contains("không có quyền chỉnh sửa hoặc xóa bài viết của tác giả khác"));
        verify(adminArticleService, never()).update(any(), any(), any());
    }

    @Test
    @DisplayName("Doctor cannot delete article of another author (IDOR rejected with 403 Forbidden)")
    void cannotDeleteOtherDoctorArticle() {
        Article otherArticle = new Article();
        otherArticle.setSlug("bai-viet-nguoi-khac");
        otherArticle.setAuthorName("BS.CKI Lê Văn Đức");

        when(articleRepository.findBySlug("bai-viet-nguoi-khac")).thenReturn(Optional.of(otherArticle));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () ->
            controller.deleteArticle("bai-viet-nguoi-khac", doctorActor)
        );
        assertTrue(ex.getMessage().contains("không có quyền chỉnh sửa hoặc xóa bài viết của tác giả khác"));
        verify(adminArticleService, never()).delete(any(), any());
    }

    @Test
    @DisplayName("Doctor can successfully update their own article and authorName is enforced")
    void canUpdateOwnArticleWithEnforcedAuthor() {
        Article ownArticle = new Article();
        ownArticle.setSlug("bai-viet-cua-khoi");
        ownArticle.setTitle("Bài viết của Khôi");
        ownArticle.setAuthorName("TS.BS Nguyễn Minh Khôi");

        when(articleRepository.findBySlug("bai-viet-cua-khoi")).thenReturn(Optional.of(ownArticle));

        ArticleRequest request = new ArticleRequest(
            "Cập nhật bài viết", "bai-viet-cua-khoi", "Tóm tắt", "Nội dung",
            "Tim mạch", "Tác Giả Giả Mạo", 5, "tim-mach", "GENERAL", null,
            null, null, null, null, null, null, "vi", "GENERAL", null, null, null, null, null, null, null, null, false, true
        );

        controller.updateArticle("bai-viet-cua-khoi", request, doctorActor);

        ArgumentCaptor<ArticleRequest> captor = ArgumentCaptor.forClass(ArticleRequest.class);
        verify(adminArticleService).update(eq("bai-viet-cua-khoi"), captor.capture(), eq(doctorActor));

        // Ensure authorName was enforced to doctor's real name instead of "Tác Giả Giả Mạo"
        assertEquals("TS.BS Nguyễn Minh Khôi", captor.getValue().authorName());
    }

    @Test
    @DisplayName("Doctor createArticle strictly enforces logged-in doctor name")
    void createArticleStrictlyEnforcesDoctorName() {
        ArticleRequest request = new ArticleRequest(
            "Bài viết mới", "bai-viet-moi", "Tóm tắt", "Nội dung",
            "Tim mạch", "Tên Tùy Ý", 5, "tim-mach", "GENERAL", null,
            null, null, null, null, null, null, "vi", "GENERAL", null, null, null, null, null, null, null, null, false, true
        );

        controller.createArticle(request, doctorActor);

        ArgumentCaptor<ArticleRequest> captor = ArgumentCaptor.forClass(ArticleRequest.class);
        verify(adminArticleService).create(captor.capture(), eq(doctorActor));
        assertEquals("TS.BS Nguyễn Minh Khôi", captor.getValue().authorName());
    }

    @Test
    @DisplayName("listArticles filters by logged-in doctor name")
    void listArticlesFiltersByDoctor() {
        Pageable pageable = PageRequest.of(0, 20);
        when(articleService.listByAuthor(eq("TS.BS Nguyễn Minh Khôi"), any(), eq("Nguyễn Minh Khôi"), eq("GENERAL"), eq(pageable)))
            .thenReturn(new PageImpl<>(List.of()));

        controller.listArticles("GENERAL", pageable, doctorActor);

        verify(articleService).listByAuthor(
            eq("TS.BS Nguyễn Minh Khôi"),
            eq("Nguyễn Minh Khôi"),
            eq("Nguyễn Minh Khôi"),
            eq("GENERAL"),
            eq(pageable)
        );
    }
}
