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

    private ArticleRequest updateRequest(String slug, String authorName) {
        return new ArticleRequest(
            "Cập nhật bài viết", slug, "Tóm tắt", "Nội dung",
            "Tim mạch", authorName, 5, "tim-mach", "GENERAL", null,
            null, null, null, null, null, null, "vi", "GENERAL", null, null, null, null, null, null, null, null, false, true
        );
    }

    @Test
    @DisplayName("Doctor cannot edit article bound to another doctor id (IDOR / BOLA rejected with 403 Forbidden)")
    void cannotEditOtherDoctorArticle() {
        Article otherArticle = new Article();
        otherArticle.setSlug("bai-viet-nguoi-khac");
        otherArticle.setTitle("Bài viết người khác");
        otherArticle.setAuthorName("BS.CKII Võ Thị Mai");
        otherArticle.setAuthorDoctorId(UUID.randomUUID());

        when(articleRepository.findBySlug("bai-viet-nguoi-khac")).thenReturn(Optional.of(otherArticle));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () ->
            controller.updateArticle("bai-viet-nguoi-khac", updateRequest("bai-viet-nguoi-khac", "BS.CKII Võ Thị Mai"), doctorActor)
        );
        assertTrue(ex.getMessage().contains("không có quyền chỉnh sửa hoặc xóa bài viết của tác giả khác"));
        verify(adminArticleService, never()).update(any(), any(), any(), any());
    }

    @Test
    @DisplayName("Doctor cannot delete article bound to another doctor id (IDOR rejected with 403 Forbidden)")
    void cannotDeleteOtherDoctorArticle() {
        Article otherArticle = new Article();
        otherArticle.setSlug("bai-viet-nguoi-khac");
        otherArticle.setAuthorName("BS.CKI Lê Văn Đức");
        otherArticle.setAuthorDoctorId(UUID.randomUUID());

        when(articleRepository.findBySlug("bai-viet-nguoi-khac")).thenReturn(Optional.of(otherArticle));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () ->
            controller.deleteArticle("bai-viet-nguoi-khac", doctorActor)
        );
        assertTrue(ex.getMessage().contains("không có quyền chỉnh sửa hoặc xóa bài viết của tác giả khác"));
        verify(adminArticleService, never()).delete(any(), any());
    }

    @Test
    @DisplayName("Identical display name does not grant ownership when doctor ids differ")
    void sameDisplayNameDoesNotGrantOwnership() {
        Article sameNameArticle = new Article();
        sameNameArticle.setSlug("bai-viet-trung-ten");
        // Name matches the caller exactly, but the article belongs to another doctor row.
        sameNameArticle.setAuthorName("TS.BS Nguyễn Minh Khôi");
        sameNameArticle.setAuthorDoctorId(UUID.randomUUID());

        when(articleRepository.findBySlug("bai-viet-trung-ten")).thenReturn(Optional.of(sameNameArticle));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () ->
            controller.updateArticle("bai-viet-trung-ten", updateRequest("bai-viet-trung-ten", "TS.BS Nguyễn Minh Khôi"), doctorActor)
        );
        assertTrue(ex.getMessage().contains("không có quyền chỉnh sửa hoặc xóa bài viết của tác giả khác"));
        verify(adminArticleService, never()).update(any(), any(), any(), any());
    }

    @Test
    @DisplayName("Doctor id is the authority: a stale display name still allows the true owner to edit")
    void staleDisplayNameStillAllowsOwnerById() {
        Article ownArticle = new Article();
        ownArticle.setSlug("bai-viet-cua-khoi");
        ownArticle.setAuthorName("BS.CKII Võ Thị Mai");
        ownArticle.setAuthorDoctorId(doctor.getId());

        when(articleRepository.findBySlug("bai-viet-cua-khoi")).thenReturn(Optional.of(ownArticle));

        controller.updateArticle("bai-viet-cua-khoi", updateRequest("bai-viet-cua-khoi", "Tên Ai Đó"), doctorActor);

        verify(adminArticleService).update(eq("bai-viet-cua-khoi"), any(), eq(doctorActor), eq(doctor.getId()));
    }

    @Test
    @DisplayName("Legacy row with NULL authorDoctorId and a foreign author name stays forbidden")
    void legacyRowWithForeignNameStaysForbidden() {
        Article legacyArticle = new Article();
        legacyArticle.setSlug("bai-viet-truoc-backfill");
        legacyArticle.setAuthorName("BS.CKII Võ Thị Mai");

        when(articleRepository.findBySlug("bai-viet-truoc-backfill")).thenReturn(Optional.of(legacyArticle));

        ForbiddenException ex = assertThrows(ForbiddenException.class, () ->
            controller.updateArticle("bai-viet-truoc-backfill", updateRequest("bai-viet-truoc-backfill", "BS.CKII Võ Thị Mai"), doctorActor)
        );
        assertTrue(ex.getMessage().contains("không có quyền chỉnh sửa hoặc xóa bài viết của tác giả khác"));
        verify(adminArticleService, never()).update(any(), any(), any(), any());
    }

    @Test
    @DisplayName("Doctor can update their own article by id and authorName is enforced")
    void canUpdateOwnArticleWithEnforcedAuthor() {
        Article ownArticle = new Article();
        ownArticle.setSlug("bai-viet-cua-khoi");
        ownArticle.setTitle("Bài viết của Khôi");
        ownArticle.setAuthorName("TS.BS Nguyễn Minh Khôi");
        ownArticle.setAuthorDoctorId(doctor.getId());

        when(articleRepository.findBySlug("bai-viet-cua-khoi")).thenReturn(Optional.of(ownArticle));

        ArticleRequest request = updateRequest("bai-viet-cua-khoi", "Tác Giả Giả Mạo");

        controller.updateArticle("bai-viet-cua-khoi", request, doctorActor);

        ArgumentCaptor<ArticleRequest> captor = ArgumentCaptor.forClass(ArticleRequest.class);
        verify(adminArticleService).update(eq("bai-viet-cua-khoi"), captor.capture(), eq(doctorActor), eq(doctor.getId()));

        // Ensure authorName was enforced to doctor's real name instead of "Tác Giả Giả Mạo"
        assertEquals("TS.BS Nguyễn Minh Khôi", captor.getValue().authorName());
    }

    @Test
    @DisplayName("Legacy row with NULL authorDoctorId and matching name is editable and self-heals to the caller id")
    void legacyMatchingNameSelfHealsAuthorDoctorId() {
        Article legacyArticle = new Article();
        legacyArticle.setSlug("bai-viet-truoc-backfill");
        legacyArticle.setAuthorName("TS.BS Nguyễn Minh Khôi");

        when(articleRepository.findBySlug("bai-viet-truoc-backfill")).thenReturn(Optional.of(legacyArticle));

        controller.updateArticle("bai-viet-truoc-backfill", updateRequest("bai-viet-truoc-backfill", "TS.BS Nguyễn Minh Khôi"), doctorActor);

        // The write must carry the caller's doctor id so the row is bound on save.
        verify(adminArticleService).update(eq("bai-viet-truoc-backfill"), any(), eq(doctorActor), eq(doctor.getId()));
    }

    @Test
    @DisplayName("Doctor createArticle strictly enforces logged-in doctor name and binds the doctor id")
    void createArticleStrictlyEnforcesDoctorNameAndId() {
        ArticleRequest request = new ArticleRequest(
            "Bài viết mới", "bai-viet-moi", "Tóm tắt", "Nội dung",
            "Tim mạch", "Tên Tùy Ý", 5, "tim-mach", "GENERAL", null,
            null, null, null, null, null, null, "vi", "GENERAL", null, null, null, null, null, null, null, null, false, true
        );

        controller.createArticle(request, doctorActor);

        ArgumentCaptor<ArticleRequest> captor = ArgumentCaptor.forClass(ArticleRequest.class);
        verify(adminArticleService).create(captor.capture(), eq(doctorActor), eq(doctor.getId()));
        assertEquals("TS.BS Nguyễn Minh Khôi", captor.getValue().authorName());
    }

    @Test
    @DisplayName("listArticles is scoped by the logged-in doctor id, never by display name")
    void listArticlesFiltersByDoctorId() {
        Pageable pageable = PageRequest.of(0, 20);
        when(articleService.listByAuthorDoctorId(eq(doctor.getId()), eq("GENERAL"), eq(pageable)))
            .thenReturn(new PageImpl<>(List.of()));

        controller.listArticles("GENERAL", pageable, doctorActor);

        // The read path must use the same authority as PUT/DELETE. Routing this
        // through the legacy name query is what let two doctors that share a
        // display name read each other's rows.
        verify(articleService).listByAuthorDoctorId(eq(doctor.getId()), eq("GENERAL"), eq(pageable));
        verify(articleService, never()).listByAuthor(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("An account with no doctors row keeps the historical V93 name fallback")
    void listArticlesFallsBackToNameOnlyWithoutDoctorRow() {
        Pageable pageable = PageRequest.of(0, 20);
        when(doctorRepository.findByUserId(doctorUser.getId())).thenReturn(Optional.empty());
        when(articleService.listByAuthor(eq("Nguyễn Minh Khôi"), any(), any(), eq("GENERAL"), eq(pageable)))
            .thenReturn(new PageImpl<>(List.of()));

        controller.listArticles("GENERAL", pageable, doctorActor);

        verify(articleService).listByAuthor(
            eq("Nguyễn Minh Khôi"),
            eq("Nguyễn Minh Khôi"),
            eq("Nguyễn Minh Khôi"),
            eq("GENERAL"),
            eq(pageable)
        );
        verify(articleService, never()).listByAuthorDoctorId(any(), any(), any());
    }
}
