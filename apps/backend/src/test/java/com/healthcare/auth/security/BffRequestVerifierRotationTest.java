package com.healthcare.auth.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;

/**
 * The rotation window for the BFF service credential.
 *
 * <p>The frontend runs on Vercel and the backend on Render, and each platform
 * only picks up an environment change on redeploy. Rotating the shared token
 * therefore has a window in which one side holds the old value and the other
 * the new one, and every API call would answer 401 for the length of that
 * window. {@code app.security.bff.service-token-previous} closes it by letting
 * the backend accept both while the frontend catches up.
 *
 * <p>The property is a window, not a feature: it must be cleared once the
 * rotation completes, which is why the second credential is only accepted when
 * it is explicitly configured.
 */
class BffRequestVerifierRotationTest {

    private static final String CURRENT = "current-credential-0123456789abcdef";
    private static final String PREVIOUS = "previous-credential-0123456789abcdef";

    private static MockHttpServletRequest requestWith(String token) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (token != null) {
            request.addHeader(BffRequestVerifier.CREDENTIAL_HEADER, token);
        }
        return request;
    }

    private static BffRequestVerifier verifier(String current, String previous) {
        MockEnvironment environment = new MockEnvironment();
        if (current != null) {
            environment.setProperty("app.security.bff.service-token", current);
        }
        if (previous != null) {
            environment.setProperty("app.security.bff.service-token-previous", previous);
        }
        return new BffRequestVerifier(environment);
    }

    @Test
    @DisplayName("with no window configured, only the current credential is accepted")
    void withoutPreviousOnlyCurrentIsAccepted() {
        BffRequestVerifier verifier = verifier(CURRENT, null);

        assertThat(verifier.isTrusted(requestWith(CURRENT))).isTrue();
        assertThat(verifier.isTrusted(requestWith(PREVIOUS))).isFalse();
        assertThat(verifier.isAcceptingPreviousCredential()).isFalse();
    }

    @Test
    @DisplayName("during a rotation window both credentials are accepted")
    void duringRotationBothAreAccepted() {
        BffRequestVerifier verifier = verifier(CURRENT, PREVIOUS);

        assertThat(verifier.isAcceptingPreviousCredential()).isTrue();
        // The frontend still sends the old value until it redeploys; this is the
        // call that would otherwise 401.
        assertThat(verifier.isTrusted(requestWith(PREVIOUS))).isTrue();
        assertThat(verifier.isTrusted(requestWith(CURRENT))).isTrue();
    }

    @Test
    @DisplayName("closing the window retires the old credential")
    void closingTheWindowRetiresPrevious() {
        assertThat(verifier(CURRENT, PREVIOUS).isTrusted(requestWith(PREVIOUS))).isTrue();

        BffRequestVerifier afterRotation = verifier(CURRENT, null);
        assertThat(afterRotation.isTrusted(requestWith(PREVIOUS))).isFalse();
        assertThat(afterRotation.isTrusted(requestWith(CURRENT))).isTrue();
    }

    @Test
    @DisplayName("an unrelated or absent credential is still refused during the window")
    void windowDoesNotWidenBeyondTheTwoCredentials() {
        BffRequestVerifier verifier = verifier(CURRENT, PREVIOUS);

        assertThat(verifier.isTrusted(requestWith("some-other-credential-0123456789"))).isFalse();
        assertThat(verifier.isTrusted(requestWith(null))).isFalse();
        assertThat(verifier.isTrusted(requestWith(""))).isFalse();
    }

    @Test
    @DisplayName("the previous credential is held to the same entropy floor")
    void previousCredentialMustMeetTheLengthFloor() {
        assertThatThrownBy(() -> verifier(CURRENT, "too-short"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("at least 32 bytes");
    }

    @Test
    @DisplayName("a blank previous value does not open a window")
    void blankPreviousDoesNotOpenAWindow() {
        // The property is present in application.yml with an empty default, so a
        // blank value must mean "no window" rather than "accept an empty token".
        BffRequestVerifier verifier = verifier(CURRENT, "   ");

        assertThat(verifier.isAcceptingPreviousCredential()).isFalse();
        assertThat(verifier.isTrusted(requestWith("   "))).isFalse();
        assertThat(verifier.isTrusted(requestWith(CURRENT))).isTrue();
    }

    @Test
    @DisplayName("a runtime with no credential accepts nothing")
    void noCredentialAcceptsNothing() {
        BffRequestVerifier verifier = verifier(null, null);

        assertThat(verifier.isTrusted(requestWith(""))).isFalse();
        assertThat(verifier.isTrusted(requestWith(CURRENT))).isFalse();
    }
}
