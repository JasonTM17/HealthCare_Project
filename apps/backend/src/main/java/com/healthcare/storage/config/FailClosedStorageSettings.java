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

    public FailClosedStorageSettings(
            @Value("${storage.upload-enabled:false}") boolean uploadEnabled,
            @Value("${storage.av.required:false}") boolean avRequired,
            @Value("${storage.allow-unscanned-upload:false}") boolean allowUnscannedUpload) {
        this.uploadEnabled = uploadEnabled;
        this.avRequired = avRequired;
        this.allowUnscannedUpload = allowUnscannedUpload;
    }

    @PostConstruct
    public void validate() {
        FailClosedStoragePolicy.validate(uploadEnabled, avRequired, allowUnscannedUpload);
    }
}
