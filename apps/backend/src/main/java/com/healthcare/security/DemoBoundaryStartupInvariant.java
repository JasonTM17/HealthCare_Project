package com.healthcare.security;

import com.healthcare.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Startup posture check for the demo trust boundary (HC-01, D-01).
 *
 * <p>Logs the active demo policy at startup so operators can see which mode a
 * deployment is running. When a deployment declares itself non-demo
 * ({@code healthcare.demo.login-allowed=false}), any still-ACTIVE shared demo
 * persona is a leftover/misconfiguration: those rows cannot log in anymore,
 * but they remain visible drift, so this runner calls them out explicitly with
 * the remediation. It logs rather than fails startup so a residual fixture row
 * cannot brick a live deployment.
 */
@Component
public class DemoBoundaryStartupInvariant implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoBoundaryStartupInvariant.class);

    private final DemoBoundaryProperties properties;
    private final UserRepository userRepository;

    public DemoBoundaryStartupInvariant(DemoBoundaryProperties properties, UserRepository userRepository) {
        this.properties = properties;
        this.userRepository = userRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (properties.isLoginAllowed()) {
            log.info(
                "Demo boundary: mode={}, demo login allowed. High-impact financial/security "
                    + "mutations are denied server-side for demo principals.",
                properties.getBoundary()
            );
            return;
        }
        long activeDemoAccounts = userRepository.countByDemoTrueAndStatus("ACTIVE");
        if (activeDemoAccounts > 0) {
            log.warn(
                "Non-demo deployment (healthcare.demo.login-allowed=false) still has {} ACTIVE "
                    + "shared demo persona(s). They are rejected at authentication, but deactivate "
                    + "or remove these rows to keep this deployment free of demo fixtures.",
                activeDemoAccounts
            );
        } else {
            log.info("Demo boundary: mode={}, demo login disabled, no ACTIVE demo personas present.",
                properties.getBoundary());
        }
    }
}
