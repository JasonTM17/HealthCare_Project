package com.healthcare.storage.config;

import com.healthcare.storage.FailClosedStoragePolicy;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class FailClosedStorageSettings {

    private final boolean uploadEnabled;
    private final boolean avRequired;
    private final boolean allowUnscannedUpload;
    private final boolean consultationEnabled;
    private final boolean requirePrivateEndpoint;
    private final String accessKey;
    private final String secretKey;

    public FailClosedStorageSettings(
            @Value("${storage.upload-enabled:false}") boolean uploadEnabled,
            @Value("${storage.av.required:false}") boolean avRequired,
            @Value("${storage.allow-unscanned-upload:false}") boolean allowUnscannedUpload,
            @Value("${storage.consultation.enabled:false}") boolean consultationEnabled,
            @Value("${storage.require-private-endpoint:false}") boolean requirePrivateEndpoint,
            @Value("${storage.access-key:}") String accessKey,
            @Value("${storage.secret-key:}") String secretKey) {
        this.uploadEnabled = uploadEnabled;
        this.avRequired = avRequired;
        this.allowUnscannedUpload = allowUnscannedUpload;
        this.consultationEnabled = consultationEnabled;
        this.requirePrivateEndpoint = requirePrivateEndpoint;
        this.accessKey = accessKey;
        this.secretKey = secretKey;
    }

    @PostConstruct
    public void validate() {
        FailClosedStoragePolicy.validate(uploadEnabled, avRequired, allowUnscannedUpload);
        FailClosedStoragePolicy.validateStorageEnabledPosture(
            uploadEnabled || consultationEnabled,
            requirePrivateEndpoint,
            accessKey,
            secretKey,
            allowUnscannedUpload);
    }
}
