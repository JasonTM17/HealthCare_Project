package com.healthcare.healthqa;

import com.healthcare.ai.service.AiClinicalContentRevisionService;
import com.healthcare.healthqa.dto.HealthQuestionContracts;
import com.healthcare.healthqa.service.HealthQuestionService;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Container-free fixture that exercises the Q&A transactional boundary. */
final class HealthQuestionDecisionTestSupport {
    private HealthQuestionDecisionTestSupport() {}

    static Fixture fixture(boolean selfApproval) {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:healthqa_" + UUID.randomUUID().toString().replace("-", "")
            + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1");

        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE users(id UUID PRIMARY KEY, status VARCHAR(32) NOT NULL)");
        jdbc.execute("CREATE TABLE roles(id UUID PRIMARY KEY, code VARCHAR(32) NOT NULL)");
        jdbc.execute("CREATE TABLE user_roles(user_id UUID NOT NULL, role_id UUID NOT NULL)");
        jdbc.execute("CREATE TABLE doctors(id UUID PRIMARY KEY, user_id UUID NOT NULL, active BOOLEAN NOT NULL)");
        jdbc.execute("""
            CREATE TABLE health_questions(
                id UUID PRIMARY KEY,
                status VARCHAR(32) NOT NULL,
                normalized_question VARCHAR(4000) NOT NULL,
                topic_slug VARCHAR(180) NOT NULL)
            """);
        jdbc.execute("""
            CREATE TABLE health_question_answers(
                id UUID PRIMARY KEY,
                question_id UUID NOT NULL,
                revision BIGINT NOT NULL,
                doctor_user_id UUID NOT NULL,
                answer_text VARCHAR(4000) NOT NULL,
                answer_hash VARCHAR(64) NOT NULL,
                status VARCHAR(32) NOT NULL,
                reviewer_user_id UUID,
                reviewed_at TIMESTAMP WITH TIME ZONE,
                review_reason_code VARCHAR(32))
            """);
        jdbc.execute("""
            CREATE TABLE faqs(
                id UUID PRIMARY KEY,
                origin_question_id UUID,
                active BOOLEAN,
                published_at TIMESTAMP WITH TIME ZONE,
                published_by UUID)
            """);

        UUID reviewerId = UUID.randomUUID();
        UUID answerDoctorId = selfApproval ? reviewerId : UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        UUID answerId = UUID.randomUUID();
        jdbc.update("INSERT INTO users(id, status) VALUES (?, 'ACTIVE')", reviewerId);
        jdbc.update("INSERT INTO roles(id, code) VALUES (?, 'DOCTOR')", roleId);
        jdbc.update("INSERT INTO user_roles(user_id, role_id) VALUES (?, ?)", reviewerId, roleId);
        jdbc.update("INSERT INTO doctors(id, user_id, active) VALUES (?, ?, TRUE)", UUID.randomUUID(), reviewerId);
        jdbc.update("""
            INSERT INTO health_questions(id, status, normalized_question, topic_slug)
            VALUES (?, 'ANSWER_SUBMITTED', 'Cach theo doi huyet ap tai nha?', 'tim-mach')
            """, questionId);
        jdbc.update("""
            INSERT INTO health_question_answers(
                id, question_id, revision, doctor_user_id, answer_text, answer_hash, status)
            VALUES (?, ?, 1, ?, 'Do huyet ap dung tu the va ghi lai ket qua.', ?, 'SUBMITTED')
            """, answerId, questionId, answerDoctorId, "a".repeat(64));

        UserDetails principal = mock(UserDetails.class);
        when(principal.getUsername()).thenReturn("reviewer@example.test");
        UserRepository users = mock(UserRepository.class);
        User reviewer = new User();
        reviewer.setId(reviewerId);
        when(users.findByEmail("reviewer@example.test")).thenReturn(Optional.of(reviewer));

        FaqRepository faqs = mock(FaqRepository.class);
        when(faqs.saveAndFlush(any(Faq.class))).thenAnswer(invocation -> {
            Faq faq = invocation.getArgument(0);
            if (faq.getId() == null) faq.setId(UUID.randomUUID());
            return faq;
        });
        AiClinicalContentRevisionService revisions = mock(AiClinicalContentRevisionService.class);
        HealthQuestionService service = new HealthQuestionService(jdbc, users, faqs, revisions);
        TransactionTemplate transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));

        return new Fixture(jdbc, service, transactions, principal, faqs, revisions,
            questionId, answerId, reviewerId);
    }

    record Fixture(
            JdbcTemplate jdbc,
            HealthQuestionService service,
            TransactionTemplate transactions,
            UserDetails principal,
            FaqRepository faqs,
            AiClinicalContentRevisionService revisions,
            UUID questionId,
            UUID answerId,
            UUID reviewerId) {

        void approve() {
            transactions.executeWithoutResult(ignored -> service.decide(
                questionId, new HealthQuestionContracts.DecisionRequest("APPROVE", null), principal));
        }

        void preparePublishedFaq() {
            UUID faqId = UUID.randomUUID();
            jdbc.update("UPDATE health_questions SET status = 'PUBLISHED' WHERE id = ?", questionId);
            jdbc.update("UPDATE health_question_answers SET status = 'APPROVED', reviewer_user_id = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?", UUID.randomUUID(), answerId);
            jdbc.update("INSERT INTO faqs(id, origin_question_id, active, published_at, published_by) VALUES (?, ?, TRUE, CURRENT_TIMESTAMP, ?)", faqId, questionId, UUID.randomUUID());
            Faq faq = new Faq();
            faq.setId(faqId);
            faq.setQuestion("Cach theo doi huyet ap tai nha?");
            faq.setAnswer("Do huyet ap dung tu the va ghi lai ket qua.");
            faq.setOriginQuestionId(questionId);
            faq.setActive(true);
            when(faqs.findById(faqId)).thenReturn(Optional.of(faq));
        }

        void revoke() {
            transactions.executeWithoutResult(ignored -> service.decide(
                questionId, new HealthQuestionContracts.DecisionRequest("REVOKE", "SAFETY_CONCERN"), principal));
        }

        String questionStatus() {
            return jdbc.queryForObject(
                "SELECT status FROM health_questions WHERE id = ?", String.class, questionId);
        }

        String answerStatus() {
            return jdbc.queryForObject(
                "SELECT status FROM health_question_answers WHERE id = ?", String.class, answerId);
        }

        UUID answerReviewer() {
            return jdbc.queryForObject(
                "SELECT reviewer_user_id FROM health_question_answers WHERE id = ?", UUID.class, answerId);
        }
    }
}
