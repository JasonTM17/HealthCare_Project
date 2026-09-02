package com.healthcare.hospital;

import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.service.AdminArticleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.AdditionalAnswers.delegatesTo;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/** PostgreSQL-backed proof for the read-before-write article slug race. */
class ArticleSlugConcurrencyIntegrationTest extends TestcontainersIntegrationTest {

    @Autowired
    private ArticleRepository articleRepository;

    @Autowired
    private org.springframework.transaction.PlatformTransactionManager transactionManager;

    @Test
    void concurrentCreatesKeepOneRowAndReturnOneStableConflict() throws Exception {
        String fixtureSlug = "ak-audit-race-" + UUID.randomUUID();
        CountDownLatch bothReadMissing = new CountDownLatch(2);
        AtomicInteger threadNumber = new AtomicInteger();
        ExecutorService executor = Executors.newFixedThreadPool(2, runnable ->
            new Thread(runnable, "article-slug-race-" + threadNumber.incrementAndGet())
        );
        ArticleRepository controlledRepository = mock(ArticleRepository.class, delegatesTo(articleRepository));
        AdminArticleService articleService = new AdminArticleService(controlledRepository);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        doAnswer(invocation -> {
            Optional<Article> found = articleRepository.findBySlug(invocation.getArgument(0));
            if (fixtureSlug.equals(invocation.getArgument(0))
                    && Thread.currentThread().getName().startsWith("article-slug-race-")) {
                assertThat(found).as("both racing prechecks must observe no article").isEmpty();
                bothReadMissing.countDown();
                if (!bothReadMissing.await(10, TimeUnit.SECONDS)) {
                    throw new AssertionError("concurrent article prechecks did not rendezvous");
                }
            }
            return found;
        }).when(controlledRepository).findBySlug(fixtureSlug);

        ArticleRequest request = new ArticleRequest(
            "AK audit concurrent fixture",
            fixtureSlug,
            "Synthetic summary without PHI",
            "Synthetic body without PHI",
            false
        );

        try {
            Future<Article> first = executor.submit(() -> transaction.execute(status -> articleService.create(request)));
            Future<Article> second = executor.submit(() -> transaction.execute(status -> articleService.create(request)));

            int successes = 0;
            int conflicts = 0;
            for (Future<Article> result : new Future[]{first, second}) {
                try {
                    assertThat(result.get(20, TimeUnit.SECONDS).getSlug()).isEqualTo(fixtureSlug);
                    successes++;
                } catch (ExecutionException failure) {
                    assertThat(failure.getCause()).isInstanceOf(DuplicateResourceException.class);
                    BusinessException conflict = (BusinessException) failure.getCause();
                    assertThat(conflict.getStatus()).isEqualTo(409);
                    assertThat(conflict.getCode()).isEqualTo("CONFLICT");
                    assertThat(conflict.getMessage()).isEqualTo("Article slug already exists");
                    conflicts++;
                }
            }

            assertThat(successes).isEqualTo(1);
            assertThat(conflicts).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM articles WHERE slug = ?", Long.class, fixtureSlug
            )).isEqualTo(1L);
            verify(controlledRepository, times(2)).saveAndFlush(org.mockito.ArgumentMatchers.any(Article.class));
        } finally {
            executor.shutdownNow();
            executor.awaitTermination(5, TimeUnit.SECONDS);
            if (articleRepository.findBySlug(fixtureSlug).isPresent()) {
                transaction.executeWithoutResult(status -> articleService.delete(fixtureSlug));
            }
            assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM articles WHERE slug = ?", Long.class, fixtureSlug
            )).isZero();
        }
    }
}
