package com.healthcare;

import com.healthcare.security.JwtProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(JwtProperties.class)
public class HealthCareBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(HealthCareBackendApplication.class, args);
    }
}
