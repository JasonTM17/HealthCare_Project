package com.healthcare.document.service;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * MinIO adapter over the shared {@link MinioClient} bean. Objects live under
 * the documents/ prefix of the existing private bucket and are only reachable
 * through the authorized download endpoint.
 */
@Component
public class MinioDocumentObjectStore implements DocumentObjectStore {

    static final String OBJECT_PREFIX = "documents/";

    private final MinioClient minioClient;
    private final String bucket;
    private final AtomicBoolean bucketReady = new AtomicBoolean(false);

    @Autowired
    public MinioDocumentObjectStore(
            MinioClient minioClient,
            @Value("${storage.bucket:${minio.bucket:healthcare-files}}") String bucket) {
        this.minioClient = minioClient;
        this.bucket = bucket;
    }

    @Override
    public void put(String objectKey, byte[] content, String contentType) throws Exception {
        ensureBucket();
        try (InputStream stream = new ByteArrayInputStream(content)) {
            minioClient.putObject(
                PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .stream(stream, content.length, -1)
                    .contentType(contentType)
                    .build()
            );
        }
    }

    @Override
    public InputStream get(String objectKey) throws Exception {
        ensureBucket();
        return minioClient.getObject(
            GetObjectArgs.builder().bucket(bucket).object(objectKey).build()
        );
    }

    @Override
    public void delete(String objectKey) throws Exception {
        ensureBucket();
        minioClient.removeObject(
            RemoveObjectArgs.builder().bucket(bucket).object(objectKey).build()
        );
    }

    @Override
    public boolean isConfigured() {
        return minioClient != null;
    }

    private void ensureBucket() throws Exception {
        if (bucketReady.get()) {
            return;
        }
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        }
        bucketReady.set(true);
    }
}
