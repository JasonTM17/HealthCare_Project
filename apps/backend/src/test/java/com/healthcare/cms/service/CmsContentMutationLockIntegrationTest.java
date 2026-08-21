package com.healthcare.cms.service;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.cms.dto.CmsContentRequest;
import com.healthcare.cms.dto.CmsContentResponse;
import com.healthcare.cms.entity.CmsComponentType;
import com.healthcare.cms.entity.CmsPublicationStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.PreparedStatement;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

class CmsContentMutationLockIntegrationTest extends AbstractIntegrationTest {

    @Autowired private CmsContentService contentService;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private PlatformTransactionManager transactionManager;

    @Test
    void cmsMutationWaitsForThePublicationCursorLockBeforeWriting() throws Exception {
        CountDownLatch lockAcquired = new CountDownLatch(1);
        CountDownLatch releaseLock = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<?> holder = executor.submit(() ->
                new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                    acquirePublicationCursorLock();
                    lockAcquired.countDown();
                    try {
                        assertThat(releaseLock.await(5, TimeUnit.SECONDS)).isTrue();
                    } catch (InterruptedException exception) {
                        Thread.currentThread().interrupt();
                        throw new AssertionError(exception);
                    }
                })
            );
            assertThat(lockAcquired.await(5, TimeUnit.SECONDS)).isTrue();

            Future<CmsContentResponse> mutation = executor.submit(() -> contentService.upsert(
                "homepage.hero",
                new CmsContentRequest(
                    CmsComponentType.HERO,
                    JsonNodeFactory.instance.objectNode()
                        .put("eyebrow", "Lock")
                        .put("title", "Serialized CMS cursor")
                        .put("body", "The mutation waits for the publication cursor lock."),
                    CmsPublicationStatus.PUBLISHED,
                    0L
                ),
                null
            ));

            Thread.sleep(300);
            assertThat(mutation).isNotDone();

            releaseLock.countDown();
            CmsContentResponse response = mutation.get(5, TimeUnit.SECONDS);
            holder.get(5, TimeUnit.SECONDS);

            assertThat(response.slotKey()).isEqualTo("homepage.hero");
            assertThat(response.version()).isEqualTo(1L);
        } finally {
            releaseLock.countDown();
            executor.shutdownNow();
        }
    }

    private void acquirePublicationCursorLock() {
        jdbcTemplate.execute((ConnectionCallback<Void>) connection -> {
            try (PreparedStatement statement = connection.prepareStatement("select pg_advisory_xact_lock(?)")) {
                statement.setLong(1, CmsContentService.PUBLICATION_CURSOR_LOCK_KEY);
                statement.execute();
            }
            return null;
        });
    }
}
