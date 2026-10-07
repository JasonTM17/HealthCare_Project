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

import java.lang.reflect.Method;
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
    private UUID doctorUserId;

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

        doctorUserId = UUID.randomUUID();
        doctorUser = new User();
        doctorUser.setId(doctorUserId);
        doctorUser.setEmail("doctor.khoi@healthcare.com");
        doctorUser.setDisplayName("Nguyễn Minh Khôi");
        doctorUser.setStatus("ACTIVE");
        doctorUser.setEmailVerified(true);

        doctor = new Doctor();
        doctor.setId(UUID.randomUUID());
        doctor.setUserId(doctorUserId);
        doctor.setFullName("TS.BS Nguyễn Minh Khôi");
        doctor.setActive(true);

        doctorActor = new org.springframework.security.core.userdetails.User(
            "doctor.khoi@healthcare.com",
            "password",
            List.of(new SimpleGrantedAuthority("ROLE_DOCTOR"))
        );

        when(userRepository.findByEmail("doctor.khoi@healthcare.com")).thenReturn(Optional.of(doctorUser));
        when(doctorRepository.findByUserId(doctorUserId)).thenReturn(Optional.of(doctor));
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
    @DisplayName("A matching legacy author name does not authorize edit or delete when owner ID is null")
    void legacyMatchingNameDoesNotAuthorizeEditOrDelete() {
        Article legacyArticle = new Article();
        legacyArticle.setSlug("bai-viet-truoc-backfill");
        legacyArticle.setAuthorName("TS.BS Nguyễn Minh Khôi");

        when(articleRepository.findBySlug("bai-viet-truoc-backfill")).thenReturn(Optional.of(legacyArticle));

        assertAll(
            () -> assertThrows(ForbiddenException.class, () ->
                controller.updateArticle("bai-viet-truoc-backfill", updateRequest("bai-viet-truoc-backfill", "TS.BS Nguyễn Minh Khôi"), doctorActor)),
            () -> assertThrows(ForbiddenException.class, () ->
                controller.deleteArticle("bai-viet-truoc-backfill", doctorActor))
        );
        verify(adminArticleService, never()).update(any(), any(), any(), any());
        verify(adminArticleService, never()).delete(any(), any());
    }

    @Test
    @DisplayName("A partial legacy author-name match does not authorize edit or delete")
    void legacySubstringMatchDoesNotAuthorizeEditOrDelete() {
        Article legacy = new Article();
        legacy.setSlug("unbound-substring");
        legacy.setAuthorName("TS.BS Nguyễn Minh Khôi - another author");

        when(articleRepository.findBySlug("unbound-substring")).thenReturn(Optional.of(legacy));

        ArticleRequest request = updateRequest("unbound-substring", "TS.BS Nguyễn Minh Khôi");

        assertAll(
            () -> assertThrows(ForbiddenException.class, () ->
                controller.updateArticle("unbound-substring", request, doctorActor)),
            () -> assertThrows(ForbiddenException.class, () ->
                controller.deleteArticle("unbound-substring", doctorActor))
        );
        verify(adminArticleService, never()).update(any(), any(), any(), any());
        verify(adminArticleService, never()).delete(any(), any());
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
    @DisplayName("An account without a linked doctor profile is denied every portal operation before article access")
    void missingDoctorProfileIsDeniedForAllPortalOperations() {
        Pageable pageable = PageRequest.of(0, 20);
        Article legacy = new Article();
        legacy.setSlug("unbound-same-name");
        legacy.setAuthorName("TS.BS Nguyễn Minh Khôi");
        when(doctorRepository.findByUserId(doctorUserId)).thenReturn(Optional.empty());
        when(articleRepository.findBySlug("unbound-same-name")).thenReturn(Optional.of(legacy));

        ArticleRequest request = updateRequest("unbound-same-name", "TS.BS Nguyễn Minh Khôi");

        assertAll(
            () -> assertThrows(ForbiddenException.class, () ->
                controller.listArticles("GENERAL", pageable, doctorActor)),
            () -> assertThrows(ForbiddenException.class, () ->
                controller.createArticle(request, doctorActor)),
            () -> assertThrows(ForbiddenException.class, () ->
                controller.updateArticle("unbound-same-name", request, doctorActor)),
            () -> assertThrows(ForbiddenException.class, () ->
                controller.deleteArticle("unbound-same-name", doctorActor)),
            () -> verifyNoInteractions(articleRepository, articleService, adminArticleService)
        );
    }

    @Test
    @DisplayName("An inactive doctor profile is denied every portal operation before article access")
    void inactiveDoctorProfileIsDeniedForAllPortalOperations() {
        Pageable pageable = PageRequest.of(0, 20);
        doctor.setActive(false);
        Article own = new Article();
        own.setSlug("inactive-doctor-article");
        own.setAuthorDoctorId(doctor.getId());
        when(articleRepository.findBySlug("inactive-doctor-article")).thenReturn(Optional.of(own));

        ArticleRequest request = updateRequest("inactive-doctor-article", doctor.getFullName());

        assertAll(
            () -> assertThrows(ForbiddenException.class, () ->
                controller.listArticles("GENERAL", pageable, doctorActor)),
            () -> assertThrows(ForbiddenException.class, () ->
                controller.createArticle(request, doctorActor)),
            () -> assertThrows(ForbiddenException.class, () ->
                controller.updateArticle("inactive-doctor-article", request, doctorActor)),
            () -> assertThrows(ForbiddenException.class, () ->
                controller.deleteArticle("inactive-doctor-article", doctorActor)),
            () -> verifyNoInteractions(articleRepository, articleService, adminArticleService)
        );
    }

    @Test
    @DisplayName("Doctor update rejects an owner change between the controller read and locked service read")
    void doctorUpdateRechecksTheLockedRowOwner() {
        String slug = "ownership-changed-after-controller-read";
        Article precheckRow = new Article();
        precheckRow.setSlug(slug);
        precheckRow.setAuthorDoctorId(doctor.getId());
        Article lockedRow = new Article();
        lockedRow.setSlug(slug);
        lockedRow.setAuthorDoctorId(UUID.randomUUID());

        when(articleRepository.findBySlug(slug)).thenReturn(Optional.of(precheckRow));
        stubLockedArticle(slug, lockedRow);

        AdminArticleService actualAdmin = new AdminArticleService(articleRepository);
        DoctorArticleController actualController = new DoctorArticleController(
            actualAdmin, articleService, articleRepository, doctorRepository, userRepository);

        assertThrows(ForbiddenException.class, () ->
            actualController.updateArticle(slug, updateRequest(slug, "Tác giả đã đổi"), doctorActor));
        verify(articleRepository, never()).saveAndFlush(any(Article.class));
    }

    @Test
    @DisplayName("Doctor delete rejects an owner change between the controller read and locked service read")
    void doctorDeleteRechecksTheLockedRowOwner() throws Exception {
        String slug = "delete-owner-changed-after-controller-read";
        Article precheckRow = new Article();
        precheckRow.setSlug(slug);
        precheckRow.setAuthorDoctorId(doctor.getId());
        Article lockedRow = new Article();
        lockedRow.setSlug(slug);
        lockedRow.setAuthorDoctorId(UUID.randomUUID());

        when(articleRepository.findBySlug(slug)).thenReturn(Optional.of(precheckRow));
        stubLockedArticle(slug, lockedRow);

        AdminArticleService.class.getMethod("delete", String.class, UserDetails.class, UUID.class);
        AdminArticleService actualAdmin = new AdminArticleService(articleRepository);
        DoctorArticleController actualController = new DoctorArticleController(
            actualAdmin, articleService, articleRepository, doctorRepository, userRepository);

        assertThrows(ForbiddenException.class, () ->
            actualController.deleteArticle(slug, doctorActor));
        verify(articleRepository, never()).delete(any(Article.class));
    }

    @Test
    @DisplayName("A locked database row overrides the controller ownership precheck during update")
    void doctorUpdateRejectsOwnerChangeAfterControllerPrecheck() {
        String slug = "ownership-changed-after-controller-read";
        Article precheckRow = new Article();
        precheckRow.setSlug(slug);
        precheckRow.setAuthorDoctorId(doctor.getId());
        Article lockedRow = new Article();
        lockedRow.setSlug(slug);
        lockedRow.setAuthorDoctorId(UUID.randomUUID());

        when(articleRepository.findBySlug(slug)).thenReturn(Optional.of(precheckRow));
        stubLockedArticle(slug, lockedRow);

        AdminArticleService actualAdmin = new AdminArticleService(articleRepository);
        DoctorArticleController actualController = new DoctorArticleController(
            actualAdmin, articleService, articleRepository, doctorRepository, userRepository);

        assertThrows(ForbiddenException.class, () ->
            actualController.updateArticle(slug, updateRequest(slug, "Tác giả đã đổi"), doctorActor));
        verify(articleRepository, never()).saveAndFlush(any(Article.class));
    }

    @Test
    @DisplayName("A locked database row overrides the controller ownership precheck during delete")
    void doctorDeleteRejectsOwnerChangeAfterControllerPrecheck() throws Exception {
        String slug = "delete-owner-changed-after-controller-read";
        Article precheckRow = new Article();
        precheckRow.setSlug(slug);
        precheckRow.setAuthorDoctorId(doctor.getId());
        Article lockedRow = new Article();
        lockedRow.setSlug(slug);
        lockedRow.setAuthorDoctorId(UUID.randomUUID());

        when(articleRepository.findBySlug(slug)).thenReturn(Optional.of(precheckRow));
        stubLockedArticle(slug, lockedRow);

        AdminArticleService.class.getMethod("delete", String.class, UserDetails.class, UUID.class);
        AdminArticleService actualAdmin = new AdminArticleService(articleRepository);
        DoctorArticleController actualController = new DoctorArticleController(
            actualAdmin, articleService, articleRepository, doctorRepository, userRepository);

        assertThrows(ForbiddenException.class, () ->
            actualController.deleteArticle(slug, doctorActor));
        verify(articleRepository, never()).delete(any(Article.class));
    }

    @Test
    @DisplayName("A renamed doctor can delete their own article by bound doctor ID")
    void doctorCanDeleteOwnRenamedArticleById() throws Exception {
        String slug = "own-renamed-doctor-article";
        Article own = new Article();
        own.setSlug(slug);
        own.setAuthorName("Old display name");
        own.setAuthorDoctorId(doctor.getId());

        when(articleRepository.findBySlug(slug)).thenReturn(Optional.of(own));
        stubLockedArticle(slug, own);

        AdminArticleService actualAdmin = new AdminArticleService(articleRepository);
        DoctorArticleController actualController = new DoctorArticleController(
            actualAdmin, articleService, articleRepository, doctorRepository, userRepository);

        assertEquals(204, actualController.deleteArticle(slug, doctorActor).getStatusCode().value());
        verify(articleRepository).delete(own);
    }

    /**
     * Stub the pessimistic-lock read used by the doctor write lanes. The
     * reflective lookup keeps this test honest: if the repository ever loses
     * the locked read again, the suite fails loudly instead of silently
     * degrading to the unlocked precheck path.
     */
    private void stubLockedArticle(String slug, Article article) {
        Method method;
        try {
            method = ArticleRepository.class.getMethod("findBySlugForUpdate", String.class);
        } catch (NoSuchMethodException missingLockLookup) {
            throw new AssertionError("ArticleRepository.findBySlugForUpdate is required", missingLockLookup);
        }
        try {
            Mockito.when(method.invoke(articleRepository, slug)).thenReturn(Optional.of(article));
        } catch (ReflectiveOperationException failure) {
            throw new AssertionError("Unable to stub the locked article lookup", failure);
        }
    }
}
