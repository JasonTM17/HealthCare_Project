package com.healthcare;

import com.healthcare.security.DemoBoundaryProperties;
import com.healthcare.security.JwtProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({JwtProperties.class, DemoBoundaryProperties.class,
    com.healthcare.auth.GoogleAuthProperties.class})
public class AppConfig {
}
