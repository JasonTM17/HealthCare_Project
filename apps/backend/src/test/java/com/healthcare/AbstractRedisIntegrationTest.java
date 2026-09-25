package com.healthcare;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;

/** Shared real Redis fixture for integration contracts that use Pub/Sub or Lua state. */
public abstract class AbstractRedisIntegrationTest extends AbstractIntegrationTest {

    private static final GenericContainer<?> testRedis = new GenericContainer<>("redis:7-alpine")
        .withExposedPorts(6379);

    static {
        testRedis.start();
    }

    @DynamicPropertySource
    static void configureRedis(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.url", () -> "redis://%s:%d".formatted(
            testRedis.getHost(), testRedis.getMappedPort(6379)));
        registry.add("ai.chat.cancellation.subscriber-enabled", () -> "true");
    }
}
