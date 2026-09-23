package com.healthcare.hospital.service;

import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ArticleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Promotes scheduled articles once their appointed time arrives.
 *
 * <p>The admin editor stores {@code scheduledPublishAt} and
 * {@code AdminArticleService.applyPublicationState} leaves {@code publishedAt}
 * null while the schedule is in the future — but nothing ever flipped the row
 * when that moment passed, so a scheduled article stayed invisible forever and
 * the promise was dead. The public read path
 * ({@code ArticleService#listPublished}/{@code getBySlug}) already filters on
 * {@code publishedAt <= now AND reviewStatus = 'APPROVED'}; this job is the
 * missing promotion step, not a second gate.
 *
 * <p>Bounded like {@code AppointmentHoldSweeper}: one transaction per tick and
 * at most one batch of {@value #BATCH_SIZE} rows, oldest schedule first. The
 * selection query carries the explicit {@code APPROVED} where-clause, so a
 * PENDING or REJECTED row can never be published by the sweep however its
 * schedule is set.
 *
 * <p>The clock is {@link OffsetDateTime#now()} — the same call
 * {@code AdminArticleService} uses when it decides a schedule is still in the
 * future and when the public queries take their cutoff, so the sweep and the
 * gate cannot disagree about "now".
 */
@Service
public class ArticlePublicationSweeper {

    private static final Logger log = LoggerFactory.getLogger(ArticlePublicationSweeper.class);
    private static final int BATCH_SIZE = 100;

    private final ArticleRepository articleRepository;

    public ArticlePublicationSweeper(ArticleRepository articleRepository) {
        this.articleRepository = articleRepository;
    }

    @Scheduled(fixedDelayString = "${app.articles.publish-sweep-ms:60000}")
    @Transactional
    public int publishDueScheduledArticles() {
        OffsetDateTime now = OffsetDateTime.now();
        List<Article> due = articleRepository.findDueScheduledPublications(
            now, PageRequest.of(0, BATCH_SIZE));
        if (due.isEmpty()) {
            return 0;
        }
        for (Article article : due) {
            article.setPublishedAt(now);
        }
        articleRepository.saveAll(due);
        log.info("Published {} due scheduled article(s).", due.size());
        return due.size();
    }
}
