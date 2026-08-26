package com.healthcare.storage;

import com.healthcare.storage.service.ConsultationObjectKeyGenerator;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ConsultationObjectKeyGeneratorTest {

    @Test
    void generatedKeyIsOpaqueThreadScopedAndCannotBeReplayedAcrossAttachment() {
        UUID thread = UUID.randomUUID();
        UUID attachment = UUID.randomUUID();
        ConsultationObjectKeyGenerator generator = new ConsultationObjectKeyGenerator("unit-test-secret");

        String key = generator.generateUpload(thread, attachment);
        String verifiedKey = generator.generateVerified(thread, attachment);

        assertThat(key).startsWith("private/consultations/");
        assertThat(key).contains("/upload/");
        assertThat(verifiedKey).contains("/verified/");
        assertThat(generator.isValid(key, thread, attachment)).isTrue();
        assertThat(generator.isValid(key, ConsultationObjectKeyGenerator.Purpose.UPLOAD,
            thread, attachment)).isTrue();
        assertThat(generator.isValid(key, ConsultationObjectKeyGenerator.Purpose.VERIFIED,
            thread, attachment)).isFalse();
        assertThat(generator.isValid(verifiedKey, ConsultationObjectKeyGenerator.Purpose.VERIFIED,
            thread, attachment)).isTrue();
        assertThat(generator.isValid(key.replace("/upload/", "/verified/"),
            thread, attachment)).isFalse();
        assertThat(generator.isValid(key, UUID.randomUUID(), attachment)).isFalse();
        assertThat(generator.isValid(key, thread, UUID.randomUUID())).isFalse();
        assertThat(generator.isValid(key + "-tampered", thread, attachment)).isFalse();
    }

    @Test
    void malformedAndPathConfusionKeysFailClosed() {
        ConsultationObjectKeyGenerator generator = new ConsultationObjectKeyGenerator("unit-test-secret");

        assertThat(generator.parse(null)).isNull();
        assertThat(generator.parse("private/consultations/../escape")).isNull();
        assertThat(generator.isValid("private/consultations/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000/x.y",
            null, null)).isFalse();
    }
}
