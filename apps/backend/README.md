# Backend

Spring Boot 3 backend baseline for HealthCare_Project.

## Commands

```bash
mvn test
mvn spring-boot:run
```

`mvn test` starts a disposable PostgreSQL 16 Testcontainer by default so
Flyway and PostgreSQL-specific booking constraints are tested without touching
the local application database. Set `TEST_DB_URL` only when targeting a
dedicated external test database, and pair it with
`TEST_DB_ALLOW_CLEANUP=true`; the integration base cleans test rows before each
method.

The AI gateway fails closed when `AI_SERVICE_TOKEN` is missing. For a bare
local process only, explicitly set `AI_SERVICE_RUNTIME=local` and
`AI_SERVICE_ALLOW_UNAUTHENTICATED_LOCAL=true`; Compose/staging/non-local
runtimes require a non-empty shared token.
