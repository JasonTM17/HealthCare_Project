package com.healthcare.auth.security;

import com.healthcare.auth.service.BrowserSessionService;
import com.healthcare.security.HealthcareUserPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class BrowserSessionAuthenticationFilter extends OncePerRequestFilter {

    private final BrowserSessionService browserSessionService;

    public BrowserSessionAuthenticationFilter(BrowserSessionService browserSessionService) {
        this.browserSessionService = browserSessionService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        // An explicit Authorization header always selects the API-client lane.
        // Never silently fall back to ambient cookies for an invalid bearer.
        if (StringUtils.hasText(request.getHeader("Authorization"))
                || SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        String rawSecret = browserSessionService.cookieValue(
            request,
            BrowserSessionService.SESSION_COOKIE_NAME
        );
        if (!StringUtils.hasText(rawSecret)) {
            filterChain.doFilter(request, response);
            return;
        }

        var resolvedSession = browserSessionService.resolveAndTouch(rawSecret);
        resolvedSession.ifPresent(resolved -> {
            HealthcareUserPrincipal principal = HealthcareUserPrincipal.from(resolved.user());
            UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                    principal,
                    null,
                    principal.getAuthorities()
                );
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            request.setAttribute(
                BrowserSessionService.REQUEST_CONTEXT_ATTRIBUTE,
                resolved.context()
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
        });
        if (resolvedSession.isEmpty()) {
            browserSessionService.clearCookies(response);
        }

        filterChain.doFilter(request, response);
    }
}
