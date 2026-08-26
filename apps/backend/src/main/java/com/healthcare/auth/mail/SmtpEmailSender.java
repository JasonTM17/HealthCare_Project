package com.healthcare.auth.mail;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "app.mail", name = "enabled", havingValue = "true")
public class SmtpEmailSender implements EmailSender, RichEmailDelivery {

    private final JavaMailSender mailSender;
    private final String from;

    public SmtpEmailSender(JavaMailSender mailSender,
                           @Value("${app.mail.from:no-reply@healthcare.local}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public void send(String recipient, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(recipient);
        message.setSubject(subject);
        message.setText(body);
        try {
            mailSender.send(message);
        } catch (MailException exception) {
            throw new com.healthcare.exception.BusinessException(
                503,
                com.healthcare.exception.ErrorCodes.EMAIL_DELIVERY_UNAVAILABLE,
                "Email delivery is temporarily unavailable"
            );
        }
    }

    @Override
    public void sendRich(String recipient, String subject, String htmlBody, String plainTextBody) {
        sendRichWithMessageId(recipient, subject, htmlBody, plainTextBody, null);
    }

    public void sendRichWithMessageId(String recipient, String subject, String htmlBody,
                                      String plainTextBody, String messageId) {
        try {
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(
                message,
                MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                "UTF-8"
            );
            helper.setFrom(from);
            helper.setTo(recipient);
            helper.setSubject(subject);
            helper.setText(plainTextBody, htmlBody);
            if (messageId != null && !messageId.isBlank()) {
                message.setHeader("Message-ID", "<" + messageId.replaceAll("[^A-Za-z0-9._-]", "") + "@healthcare.local>");
            }
            mailSender.send(message);
        } catch (MailException | jakarta.mail.MessagingException exception) {
            throw new com.healthcare.exception.BusinessException(
                503,
                com.healthcare.exception.ErrorCodes.EMAIL_DELIVERY_UNAVAILABLE,
                "Email delivery is temporarily unavailable"
            );
        }
    }
}
