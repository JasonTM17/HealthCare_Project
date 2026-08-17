package com.healthcare;

/**
 * Backward-compatible alias for {@link AbstractIntegrationTest}.
 *
 * <p>{@code AbstractIntegrationTest} owns the isolated PostgreSQL Testcontainer
 * and datasource configuration. Keeping this class as an empty alias avoids
 * duplicate containers/properties for legacy tests that still reference it.
 *
 * @deprecated Extend {@link AbstractIntegrationTest} directly.
 */
@Deprecated(forRemoval = false)
public abstract class TestcontainersIntegrationTest extends AbstractIntegrationTest {
}
