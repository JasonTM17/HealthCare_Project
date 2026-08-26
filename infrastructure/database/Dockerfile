# syntax=docker/dockerfile:1.7

FROM postgres:16-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685

ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="HealthCare Project database fixture" \
      org.opencontainers.image.description="Fictional PostgreSQL 16 schema and large local-development seed" \
      org.opencontainers.image.source="https://github.com/JasonTM17/HealthCare_Project" \
      org.opencontainers.image.revision=${VCS_REF}

COPY apps/backend/src/main/resources/db/migration/ /opt/healthcare/migrations/
COPY apps/backend/src/main/resources/db/seed/seed-large-data.sql /opt/healthcare/seed/seed-large-data.sql
COPY apps/backend/src/main/resources/db/seed/seed-local-careers.sql /opt/healthcare/seed/seed-local-careers.sql
COPY infrastructure/database/init/01-healthcare-database.sh /docker-entrypoint-initdb.d/01-healthcare-database.sh

# The official image entrypoint drops to the postgres user; this probe does not
# expose credentials and only checks that the local server accepts connections.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD pg_isready -h 127.0.0.1 -U postgres -d postgres
