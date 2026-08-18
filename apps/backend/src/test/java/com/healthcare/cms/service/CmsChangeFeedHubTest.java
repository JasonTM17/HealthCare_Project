package com.healthcare.cms.service;

import com.healthcare.cms.repository.CmsContentChangeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CmsChangeFeedHubTest {

    @Test
    void disconnectedClientCompletesQuietlyWithoutAsyncErrorDispatch() throws Exception {
        CmsContentChangeRepository repository = mock(CmsContentChangeRepository.class);
        SseEmitter disconnectedEmitter = mock(SseEmitter.class);
        when(repository.findTopByOrderByIdDesc()).thenReturn(Optional.empty());
        doThrow(new IOException("client closed"))
            .when(disconnectedEmitter)
            .send(any(SseEmitter.SseEventBuilder.class));

        CmsChangeFeedHub hub = new CmsChangeFeedHub(repository, timeout -> disconnectedEmitter);

        assertThatCode(() -> hub.open(null)).doesNotThrowAnyException();
        verify(disconnectedEmitter).complete();
        verify(disconnectedEmitter, never()).completeWithError(any());
    }

    @Test
    void fullFeedReturnsSseUnavailableEventInsteadOfJsonBusinessError() throws Exception {
        CmsContentChangeRepository repository = mock(CmsContentChangeRepository.class);
        SseEmitter activeEmitter = mock(SseEmitter.class);
        SseEmitter unavailableEmitter = mock(SseEmitter.class);
        AtomicInteger created = new AtomicInteger();
        when(repository.findTopByOrderByIdDesc()).thenReturn(Optional.empty());

        CmsChangeFeedHub hub = new CmsChangeFeedHub(
            repository,
            timeout -> created.incrementAndGet() <= 256 ? activeEmitter : unavailableEmitter
        );
        for (int connection = 0; connection < 256; connection++) {
            hub.open(null);
        }

        SseEmitter result = hub.open(null);

        assertThat(result).isSameAs(unavailableEmitter);
        verify(unavailableEmitter).send(any(SseEmitter.SseEventBuilder.class));
        verify(unavailableEmitter).complete();
        verify(unavailableEmitter, never()).completeWithError(any());
    }
}
