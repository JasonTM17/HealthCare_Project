# CI Outline

No committed CI workflow is created in the foundation scope. When authorized, CI should run only commands that are proven locally.

## Candidate Gates

1. Backend: `mvn test` in `apps/backend`.
2. Frontend: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build` in `apps/frontend`.
3. AI service: create a Python environment, install `requirements.txt`, and run `python -m pytest` in `apps/ai-service`.
4. Infrastructure: `docker compose -f infrastructure/docker-compose.yml config`.
5. Repository hygiene: secret-pattern review and `git diff --check` before commit.
