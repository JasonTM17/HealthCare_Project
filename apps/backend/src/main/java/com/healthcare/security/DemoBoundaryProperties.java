package com.healthcare.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Runtime policy for the shared synthetic demo personas (V70, finding HC-01,
 * decision D-01). The demo experience stays usable, but high-impact
 * financial/security mutations are denied server-side for demo principals and
 * explicitly non-demo deployments can switch shared demo identities off.
 *
 * <ul>
 *   <li>{@code boundary}: {@code enforce} (default) rejects the blocked
 *       mutation set for demo principals; {@code off} disables the filter for
 *       local diagnosis only.</li>
 *   <li>{@code loginAllowed}: {@code true} (default) keeps the hosted demo
 *       usable; {@code false} rejects demo principals at authentication in a
 *       deployment that must not carry the shared demo personas.</li>
 * </ul>
 */
@ConfigurationProperties(prefix = "healthcare.demo")
public class DemoBoundaryProperties {

    public enum BoundaryMode { ENFORCE, OFF }

    private BoundaryMode boundary = BoundaryMode.ENFORCE;
    private boolean loginAllowed = true;

    public BoundaryMode getBoundary() {
        return boundary;
    }

    public void setBoundary(BoundaryMode boundary) {
        this.boundary = boundary;
    }

    public boolean isLoginAllowed() {
        return loginAllowed;
    }

    public void setLoginAllowed(boolean loginAllowed) {
        this.loginAllowed = loginAllowed;
    }

    /** Convenience for relaxed config values ("enforce"/"off", case-insensitive). */
    public void setBoundary(String value) {
        this.boundary = value == null
            ? BoundaryMode.ENFORCE
            : BoundaryMode.valueOf(value.trim().toUpperCase());
    }
}
