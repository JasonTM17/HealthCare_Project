package com.healthcare.security;

import com.healthcare.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.boot.DefaultApplicationArguments;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.when;

/**
 * HC-01/D-01: the startup posture runner must never fail deployment on
 * residual demo rows, and must inspect ACTIVE demo personas exactly when the
 * deployment declares itself non-demo.
 */
class DemoBoundaryStartupInvariantTest {

    private DemoBoundaryProperties properties;
    private UserRepository userRepository;
    private DemoBoundaryStartupInvariant runner;

    @BeforeEach
    void setUp() {
        properties = new DemoBoundaryProperties();
        userRepository = Mockito.mock(UserRepository.class);
        runner = new DemoBoundaryStartupInvariant(properties, userRepository);
    }

    @Test
    @DisplayName("Demo deployments log posture and do not query active demo rows")
    void demoDeploymentLogsPostureWithoutQuery() {
        properties.setLoginAllowed(true);

        assertThatCode(() -> runner.run(new DefaultApplicationArguments()))
            .doesNotThrowAnyException();

        Mockito.verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("Non-demo deployment with residual ACTIVE demo rows warns without failing")
    void nonDemoDeploymentWarnsOnResidualDemoRows() {
        properties.setLoginAllowed(false);
        when(userRepository.countByDemoTrueAndStatus("ACTIVE")).thenReturn(6L);

        assertThatCode(() -> runner.run(new DefaultApplicationArguments()))
            .doesNotThrowAnyException();

        Mockito.verify(userRepository).countByDemoTrueAndStatus("ACTIVE");
    }

    @Test
    @DisplayName("Clean non-demo deployment stays quiet and healthy")
    void cleanNonDemoDeploymentPasses() {
        properties.setLoginAllowed(false);
        when(userRepository.countByDemoTrueAndStatus("ACTIVE")).thenReturn(0L);

        assertThatCode(() -> runner.run(new DefaultApplicationArguments()))
            .doesNotThrowAnyException();
    }
}
