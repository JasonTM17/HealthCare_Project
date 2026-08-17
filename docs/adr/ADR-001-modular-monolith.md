# ADR-001: Modular Monolith Backend

## Status

Accepted for foundation.

## Context

The platform needs healthcare domains, authentication, scheduling, content, and AI integration. Starting with distributed services for every domain would add deployment and data-consistency cost before the product boundaries are proven.

## Decision

Use a Spring Boot modular monolith for the backend. Keep domain packages isolated and expose cross-domain behavior through service interfaces. Use a separate FastAPI AI service only for AI/RAG concerns where Python tooling is materially useful.

## Consequences

- Simpler local development and transactions during early phases.
- Clear module boundaries are still required to avoid a big-ball-of-mud.
- Future extraction remains possible after domain traffic and ownership are proven.
