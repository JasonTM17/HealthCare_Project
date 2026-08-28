package com.healthcare.storage.config;

import com.healthcare.storage.service.AttachmentScanner;
import com.healthcare.storage.service.ClamAvAttachmentScanner;
import com.healthcare.storage.service.UnavailableAttachmentScanner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/** Selects a configured scanner while preserving a fail-closed unavailable default. */
@Configuration
public class AttachmentScannerConfiguration {

    @Bean
    @ConditionalOnProperty(name = "storage.av.service-url")
    @ConditionalOnMissingBean(AttachmentScanner.class)
    AttachmentScanner clamAvAttachmentScanner(
            RestClient.Builder builder,
            @Value("${storage.av.service-url:}") String endpoint,
            @Value("${storage.av.service-token:}") String token,
            @Value("${storage.av.allowed-hosts:}") String allowedHosts) {
        return new ClamAvAttachmentScanner(builder, endpoint, token, allowedHosts);
    }

    @Bean
    @ConditionalOnMissingBean(AttachmentScanner.class)
    AttachmentScanner unavailableAttachmentScanner() {
        return new UnavailableAttachmentScanner();
    }
}
