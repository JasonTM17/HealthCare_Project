# Backend

Spring Boot 3 backend baseline for HealthCare_Project.

## Commands

```bash
mvn test
mvn spring-boot:run
```

The AI gateway fails closed when `AI_SERVICE_TOKEN` is missing. For a bare
local process only, explicitly set `AI_SERVICE_RUNTIME=local` and
`AI_SERVICE_ALLOW_UNAUTHENTICATED_LOCAL=true`; Compose/staging/non-local
runtimes require a non-empty shared token.
