package com.healthcare;

/**
 * Backward-compatible alias for {@link AbstractIntegrationTest}.
 *
 * <p>{@code AbstractIntegrationTest} owns the shared datasource configuration
 * (local PostgreSQL via {@code TEST_DB_URL}). Keeping this class as an empty
 * alias avoids duplicate containers/properties for any legacy tests that may
 * still reference it.
 *
 * @deprecated Extend {@link AbstractIntegrationTest} directly.
 */
@Deprecated(forRemoval = false)
public abstract class TestcontainersIntegrationTest extends AbstractIntegrationTest {
}
