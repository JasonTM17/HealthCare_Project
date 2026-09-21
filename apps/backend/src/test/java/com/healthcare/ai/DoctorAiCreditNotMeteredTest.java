package com.healthcare.ai;

import com.healthcare.ai.entity.AiCreditTransaction;
import com.healthcare.ai.repository.AiCreditTransactionRepository;
import com.healthcare.ai.service.AiCreditService;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.appointment.repository.PatientProfileRepository;
import com.healthcare.exception.BusinessException;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.repository.DoctorRepository;
import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Pins the doctor half of the AI-credit contract: {@code doctors.ai_credits}
 * (default 150 on {@link Doctor}) is legacy storage that nothing may spend or
 * top up.
 *
 * <p>The product decision was to delete doctor AI credit rather than wire it,
 * and the behaviour it produced is already covered elsewhere:
 * {@link AiCreditService#grantCredits} refusing a {@code DOCTOR} target
 * ({@code AiCreditServiceTest}, three cases) and the request contract refusing
 * it before the service is reached ({@code AdminAiCreditControllerTest}). What
 * nothing proved is the negative half the decision actually rests on — that no
 * <em>other</em> path exists for moving a doctor's balance. A future
 * {@code deductDoctorAiCredit} could ship with every one of those tests still
 * green, because they only inspect the door that was closed.
 *
 * <p>These are structural invariants asserted against the compiled wiring
 * (fields, method signatures, {@code @Modifying} JPQL) rather than against
 * source text, so a rename cannot silently void them.
 */
class DoctorAiCreditNotMeteredTest {

    private PatientProfileRepository patientProfileRepository;
    private UserRepository userRepository;
    private AiCreditTransactionRepository transactionRepository;
    private AiCreditService creditService;

    @BeforeEach
    void setUp() {
        patientProfileRepository = Mockito.mock(PatientProfileRepository.class);
        userRepository = Mockito.mock(UserRepository.class);
        transactionRepository = Mockito.mock(AiCreditTransactionRepository.class);
        creditService = new AiCreditService(
            patientProfileRepository, userRepository, transactionRepository);
    }

    @Test
    @DisplayName("The credit service holds no doctor repository and no doctor-typed API")
    void creditServiceCarriesNoDoctorWiring() {
        List<Class<?>> fieldTypes = Arrays.stream(AiCreditService.class.getDeclaredFields())
            .map(Field::getType)
            .toList();
        // Positive control: the scan sees real dependencies, so an empty list
        // below cannot be a reflection artifact.
        assertThat(fieldTypes).contains(PatientProfileRepository.class,
            AiCreditTransactionRepository.class);

        assertThat(fieldTypes).doesNotContain(DoctorRepository.class);

        // No method in the credit domain can accept or return a doctor, so no
        // caller can hand one to a balance mutation.
        List<Class<?>> exposedTypes = Arrays.stream(AiCreditService.class.getDeclaredMethods())
            .flatMap(method -> Stream.concat(
                Arrays.stream(method.getParameterTypes()),
                Stream.of(method.getReturnType())))
            .toList();
        assertThat(exposedTypes).doesNotContain(Doctor.class);
    }

    @Test
    @DisplayName("No atomic balance update in the credit domain targets the doctors table")
    void everyBalanceMovingQueryIsPatientScoped() {
        List<Method> doctorMutations = Arrays.stream(DoctorRepository.class.getMethods())
            .filter(method -> method.isAnnotationPresent(Modifying.class))
            .toList();
        // The doctor inventory has no bulk-update path at all, so there is no
        // "update Doctor d set d.aiCredits = ..." to spend the legacy column.
        assertThat(doctorMutations).isEmpty();

        // Positive control plus the actual scope assertion: the only @Modifying
        // balance writers in this domain are the patient deduct/refund pair, and
        // each of them updates PatientProfile — never Doctor.
        List<Method> patientMutations = Arrays.stream(PatientProfileRepository.class.getMethods())
            .filter(method -> method.isAnnotationPresent(Modifying.class))
            .toList();
        assertThat(patientMutations).hasSize(2)
            .extracting(Method::getName)
            .containsExactlyInAnyOrder("deductAiCreditByUserId", "refundAiCreditByUserId");
        for (Method mutation : patientMutations) {
            Query jpql = AnnotatedElementUtils.findMergedAnnotation(mutation, Query.class);
            assertThat(jpql).isNotNull();
            assertThat(jpql.value()).contains("update PatientProfile");
            assertThat(jpql.value()).doesNotContain("Doctor");
        }
    }

    @Test
    @DisplayName("Every ledger row the credit service writes is patient-targeted")
    void noWritePathStampsADoctorLedgerRow() {
        UUID userId = UUID.randomUUID();
        PatientProfile profile = new PatientProfile();
        profile.setId(UUID.randomUUID());
        profile.setUserId(userId);
        profile.setPatientTier("STANDARD");
        profile.setAiCredits(10);
        when(patientProfileRepository.deductAiCreditByUserId(userId)).thenReturn(1);
        when(patientProfileRepository.refundAiCreditByUserId(userId)).thenReturn(1);
        when(patientProfileRepository.findAiCreditsByUserId(userId)).thenReturn(Optional.of(9));
        when(patientProfileRepository.findByUserId(userId)).thenReturn(Optional.of(profile));
        when(patientProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));

        assertThat(creditService.deductPatientCredit(userId, "Luot hoi AI")).isTrue();
        assertThat(creditService.refundPatientCredit(userId, "Hoan credit")).isTrue();
        creditService.grantCredits(userId, "PATIENT", 50, "ADMIN_GRANT", "Cap them");
        creditService.recordPatientWaiver(userId, "Khong tinh credit");
        creditService.updatePatientTier(profile.getId(), "GOLD", null);

        ArgumentCaptor<AiCreditTransaction> rows = ArgumentCaptor.forClass(AiCreditTransaction.class);
        verify(transactionRepository, Mockito.times(5)).save(rows.capture());
        // ai_credit_transactions permits target_role 'DOCTOR' (the V55 CHECK
        // constraint allows it), so the only thing keeping a doctor quota out of
        // the ledger is this service. All five write paths stay patient-targeted.
        assertThat(rows.getAllValues())
            .extracting(AiCreditTransaction::getTargetRole)
            .containsOnly("PATIENT");
    }

    @Test
    @DisplayName("A DOCTOR grant is refused before any row is read, not after a lookup")
    void doctorGrantIsRefusedWithoutTouchingAnyRepository() {
        // The existing coverage checks that nothing is saved; this pins that
        // nothing is even read, so the refusal cannot depend on which profile
        // happens to exist for the user id an operator passes.
        verifyNoInteractions(patientProfileRepository, transactionRepository);
        assertThatThrownBy(() -> creditService.grantCredits(
            UUID.randomUUID(), "DOCTOR", 100, "ADMIN_GRANT", "Cap credit cho bac si"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("bác sĩ");
        verifyNoInteractions(patientProfileRepository, transactionRepository);
    }
}
