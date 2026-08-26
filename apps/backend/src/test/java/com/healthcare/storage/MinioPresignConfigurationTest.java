package com.healthcare.storage;

import com.healthcare.storage.config.MinioConfig;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.http.Method;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

class MinioPresignConfigurationTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
        .withUserConfiguration(MinioConfig.class)
        .withPropertyValues("storage.endpoint=http://minio:9000",
            "storage.access-key=synthetic-access", "storage.secret-key=synthetic-secret");

    @Test
    void signsBrowserOriginWithoutContactingInternalOrExternalStorage() {
        runner.withPropertyValues("storage.public-endpoint=http://127.0.0.2:18001", "storage.region=us-east-1")
            .run(context -> {
                assertThat(context).hasNotFailed();
                assertThat(context.getBean(MinioClient.class)).isSameAs(context.getBean("minioClient"));
                var presigner = context.getBean("consultationPresignClient", MinioClient.class);
                assertThat(presigner).isNotSameAs(context.getBean(MinioClient.class));
                for (Method method : new Method[]{Method.PUT, Method.GET}) {
                    URI url = URI.create(presigner.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                        .method(method).bucket("healthcare-files").object("synthetic/fixture")
                        .expiry(300).build()));
                    assertThat(url.getHost()).isEqualTo("127.0.0.2");
                    assertThat(url.getPort()).isEqualTo(18001);
                    assertThat(url.getRawQuery()).contains("X-Amz-SignedHeaders=host", "X-Amz-Expires=300");
                }
            });
    }

    @Test
    void publicEndpointRequiresRegionToAvoidNetworkDiscovery() {
        runner.withPropertyValues("storage.public-endpoint=https://objects.example.test")
            .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void rejectsCredentialedOrUnencryptedHostedPublicEndpoint() {
        for (String value : new String[]{"https://user:secret@objects.example.test", "https://objects.example.test/path",
                "https://objects.example.test?token=fixture", "http://objects.example.test"}) {
            runner.withPropertyValues("storage.public-endpoint=" + value, "storage.region=us-east-1",
                    "storage.require-private-endpoint=true")
                .run(context -> assertThat(context).hasFailed());
        }
    }
}
