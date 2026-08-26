package com.healthcare.auth.mail;

/** SMTP delivery boundary that supports the code-owned HTML/plain templates. */
public interface RichEmailDelivery {

    void sendRich(String recipient, String subject, String htmlBody, String plainTextBody);
}
