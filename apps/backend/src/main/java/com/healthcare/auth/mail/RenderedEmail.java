package com.healthcare.auth.mail;

public record RenderedEmail(
    String subject,
    String preheader,
    String textBody,
    String htmlBody,
    int templateVersion
) {
    public RenderedEmail(String subject, String htmlBody, String plainTextBody) {
        this(subject, "", plainTextBody, htmlBody, 1);
    }

    public RenderedEmail(String subject, String preheader, String htmlBody, String plainTextBody) {
        this(subject, preheader, plainTextBody, htmlBody, 1);
    }

    public String plainTextBody() {
        return textBody;
    }
}
