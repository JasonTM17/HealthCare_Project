package com.healthcare.ai.chat.entity;

/** Deterministic safety outcome returned by the AI policy layer. */
public enum ChatSafetyAction {
    ANSWER,
    REFUSE,
    EMERGENCY,
    HUMAN_HANDOFF,
    INSUFFICIENT_EVIDENCE
}
