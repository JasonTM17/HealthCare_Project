package com.healthcare.ai.chat.service;

import java.util.ArrayList;
import java.util.List;

/** Split a persisted sanitized answer into cosmetic SSE deltas. Concatenation must equal the source. */
public final class ChatAnswerChunker {

    public static final int DEFAULT_SLICE = 48;

    private ChatAnswerChunker() {
    }

    public static List<String> slices(String answer) {
        return slices(answer, DEFAULT_SLICE);
    }

    public static List<String> slices(String answer, int size) {
        if (answer == null || answer.isEmpty()) {
            return List.of();
        }
        int step = Math.max(1, size);
        List<String> parts = new ArrayList<>();
        for (int index = 0; index < answer.length(); index += step) {
            parts.add(answer.substring(index, Math.min(answer.length(), index + step)));
        }
        return List.copyOf(parts);
    }
}
