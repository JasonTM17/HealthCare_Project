package com.healthcare.observability;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Establishes one bounded trace identity before security or controller work. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestTraceFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String requestId = RequestTrace.canonicalOrNew(request.getHeader(RequestTrace.HEADER));
        String previous = RequestTrace.bind(requestId);
        request.setAttribute(RequestTrace.REQUEST_ATTRIBUTE, requestId);
        response.setHeader(RequestTrace.HEADER, requestId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            RequestTrace.restore(previous);
        }
    }
}
