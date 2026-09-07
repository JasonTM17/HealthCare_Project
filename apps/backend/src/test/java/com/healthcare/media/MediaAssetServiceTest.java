package com.healthcare.media;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.media.dto.MediaAssetResponse;
import com.healthcare.media.entity.MediaAsset;
import com.healthcare.media.repository.MediaAssetRepository;
import com.healthcare.media.service.MediaAssetService;
import com.healthcare.storage.service.FileStorageService;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collections;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MediaAssetServiceTest {

    @Mock
    private MediaAssetRepository mediaAssetRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FileStorageService fileStorageService;

    private MediaAssetService mediaAssetService;

    @BeforeEach
    void setUp() {
        mediaAssetService = new MediaAssetService(mediaAssetRepository, userRepository);
    }

    @Test
    void uploadImage_successWithValidPng() throws Exception {
        byte[] pngBytes = new byte[] { (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0 };
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", pngBytes);
        UserDetails user = new User("doctor@healthcare.local", "secret", Collections.singletonList(new SimpleGrantedAuthority("ROLE_DOCTOR")));

        UUID assetId = UUID.randomUUID();
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> {
            MediaAsset asset = invocation.getArgument(0);
            asset.setId(assetId);
            return asset;
        });

        MediaAssetResponse response = mediaAssetService.uploadImage(file, "DOCTOR_PORTRAIT", user);

        assertThat(response.id()).isEqualTo(assetId);
        assertThat(response.url()).isEqualTo("/api/v1/media/" + assetId);
        assertThat(response.contentType()).isEqualTo("image/png");
        assertThat(response.purpose()).isEqualTo("DOCTOR_PORTRAIT");

        ArgumentCaptor<MediaAsset> captor = ArgumentCaptor.forClass(MediaAsset.class);
        verify(mediaAssetRepository).saveAndFlush(captor.capture());
        MediaAsset saved = captor.getValue();
        assertThat(saved.getUploaderRole()).isEqualTo("DOCTOR");
        assertThat(saved.getData()).isEqualTo(pngBytes);
        assertThat(saved.getObjectKey()).isNull();
    }

    @Test
    void uploadImage_successWithValidJpeg() throws Exception {
        byte[] jpegBytes = new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0, 0, 0 };
        MockMultipartFile file = new MockMultipartFile("file", "article_cover.jpg", "image/jpeg", jpegBytes);
        UserDetails user = new User("patient@healthcare.local", "secret", Collections.singletonList(new SimpleGrantedAuthority("ROLE_PATIENT")));

        UUID assetId = UUID.randomUUID();
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> {
            MediaAsset asset = invocation.getArgument(0);
            asset.setId(assetId);
            return asset;
        });

        MediaAssetResponse response = mediaAssetService.uploadImage(file, "ARTICLE_COVER", user);

        assertThat(response.id()).isEqualTo(assetId);
        assertThat(response.contentType()).isEqualTo("image/jpeg");
    }

    @Test
    void uploadImage_storesObjectKeyWhenStorageIsEnabled() throws Exception {
        byte[] webpBytes = new byte[] {
            'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' '
        };
        MockMultipartFile file = new MockMultipartFile("file", "doctor portrait.webp", "image/webp", webpBytes);
        UserDetails user = new User("doctor@healthcare.local", "secret", Collections.singletonList(new SimpleGrantedAuthority("ROLE_DOCTOR")));
        mediaAssetService = new MediaAssetService(mediaAssetRepository, userRepository, fileStorageService);

        UUID assetId = UUID.randomUUID();
        when(fileStorageService.isUploadEnabled()).thenReturn(true);
        when(fileStorageService.uploadPublicMedia("doctor_portrait.webp", "image/webp", webpBytes))
            .thenReturn("public/media/test-object.webp");
        when(mediaAssetRepository.saveAndFlush(any(MediaAsset.class))).thenAnswer(invocation -> {
            MediaAsset asset = invocation.getArgument(0);
            asset.setId(assetId);
            return asset;
        });

        MediaAssetResponse response = mediaAssetService.uploadImage(file, "DOCTOR_PORTRAIT", user);

        assertThat(response.id()).isEqualTo(assetId);
        ArgumentCaptor<MediaAsset> captor = ArgumentCaptor.forClass(MediaAsset.class);
        verify(mediaAssetRepository).saveAndFlush(captor.capture());
        MediaAsset saved = captor.getValue();
        assertThat(saved.getData()).isNull();
        assertThat(saved.getObjectKey()).isEqualTo("public/media/test-object.webp");
        assertThat(saved.getSizeBytes()).isEqualTo(webpBytes.length);
    }

    @Test
    void uploadImage_rejectsEmptyFile() {
        MockMultipartFile file = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);
        assertThatThrownBy(() -> mediaAssetService.uploadImage(file, "GENERAL", null))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("không được để trống");
    }

    @Test
    void uploadImage_rejectsUnsupportedType() {
        MockMultipartFile file = new MockMultipartFile("file", "doc.pdf", "application/pdf", new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 });
        assertThatThrownBy(() -> mediaAssetService.uploadImage(file, "GENERAL", null))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Định dạng tệp không được hỗ trợ");
    }

    @Test
    void uploadImage_rejectsSpoofedMagicBytes() {
        byte[] spoofed = "Not a real png file content".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "fake.png", "image/png", spoofed);
        assertThatThrownBy(() -> mediaAssetService.uploadImage(file, "GENERAL", null))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Nội dung tệp không hợp lệ hoặc bị giả mạo");
    }

    @Test
    void getMedia_success() {
        UUID id = UUID.randomUUID();
        MediaAsset asset = new MediaAsset("test.jpg", "image/jpeg", 100, new byte[] { 1, 2, 3 }, UUID.randomUUID(), "DOCTOR", "ARTICLE_COVER");
        asset.setId(id);
        when(mediaAssetRepository.findById(id)).thenReturn(Optional.of(asset));

        MediaAsset result = mediaAssetService.getMedia(id);
        assertThat(result.getId()).isEqualTo(id);
        assertThat(result.getFilename()).isEqualTo("test.jpg");
    }

    @Test
    void getMediaContent_loadsObjectStorageWhenInlineDataIsBackfilledAway() throws Exception {
        UUID id = UUID.randomUUID();
        byte[] objectBytes = new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 1, 2, 3, 4 };
        MediaAsset asset = new MediaAsset("stored.jpg", "image/jpeg", objectBytes.length, null, UUID.randomUUID(), "ADMIN", "ARTICLE_COVER");
        asset.setId(id);
        asset.setObjectKey("public/media/stored.jpg");
        mediaAssetService = new MediaAssetService(mediaAssetRepository, userRepository, fileStorageService);

        when(mediaAssetRepository.findById(id)).thenReturn(Optional.of(asset));
        when(fileStorageService.isUploadEnabled()).thenReturn(true);
        when(fileStorageService.downloadPublicMedia("public/media/stored.jpg")).thenReturn(objectBytes);

        MediaAssetService.MediaAssetContent content = mediaAssetService.getMediaContent(id);

        assertThat(content.asset().getId()).isEqualTo(id);
        assertThat(content.bytes()).isEqualTo(objectBytes);
    }

    @Test
    void getMedia_notFound() {
        UUID id = UUID.randomUUID();
        when(mediaAssetRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> mediaAssetService.getMedia(id))
            .isInstanceOf(ResourceNotFoundException.class)
            .hasMessageContaining("không tồn tại");
    }
}
