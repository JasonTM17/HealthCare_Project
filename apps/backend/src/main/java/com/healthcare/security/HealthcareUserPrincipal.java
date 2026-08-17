package com.healthcare.security;

import com.healthcare.user.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Authenticated application identity. Spring's username remains the email for
 * compatibility, while clinical ownership checks can use the immutable user id.
 */
public final class HealthcareUserPrincipal implements UserDetails {

    private final UUID userId;
    private final String email;
    private final String password;
    private final boolean enabled;
    private final Set<GrantedAuthority> authorities;

    private HealthcareUserPrincipal(
            UUID userId,
            String email,
            String password,
            boolean enabled,
            Set<GrantedAuthority> authorities) {
        this.userId = userId;
        this.email = email;
        this.password = password;
        this.enabled = enabled;
        this.authorities = Set.copyOf(authorities);
    }

    public static HealthcareUserPrincipal from(User user) {
        Set<GrantedAuthority> authorities = user.getRoles().stream()
                .map(role -> (GrantedAuthority) () -> "ROLE_" + role.getCode())
                .collect(Collectors.toUnmodifiableSet());
        return new HealthcareUserPrincipal(
                user.getId(),
                user.getEmail(),
                user.getPasswordHash(),
                "ACTIVE".equals(user.getStatus()),
                authorities
        );
    }

    public UUID getUserId() {
        return userId;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }
}
