package com.healthcare.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Forces UTF-8 request and response encoding for every request.
 *
 * <p>Without this, Tomcat decodes request bodies using ISO-8859-1 when the
 * client omits {@code charset=UTF-8} from the Content-Type header, which
 * corrupts Vietnamese (and other non-ASCII) characters before Spring MVC can
 * deserialize the body.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class Utf8Filter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");
        filterChain.doFilter(request, response);
    }
}
