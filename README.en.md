<div align="center">

# HealthCare

### A digital hospital platform for patients, clinicians, and administrators

Explore care, book appointments, follow clinical records, and run hospital operations in one system. An AI assistant helps users find information within explicit source and access boundaries.

**Language:** [English](README.en.md) · [Tiếng Việt](README.md)

[![CI](https://github.com/JasonTM17/HealthCare_Project/actions/workflows/ci.yml/badge.svg)](https://github.com/JasonTM17/HealthCare_Project/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-111827?logo=nextdotjs)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.5-6DB33F?logo=springboot&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.12-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

[Website](https://www.healthcare.id.vn) · [Documentation index](docs/README.md) · [Run locally](docs/getting-started.md) · [Architecture](docs/architecture/system-overview.md)

</div>

> Screenshots and GIFs were captured from a local demo stack with synthetic seed data. They prove that the shown interfaces rendered; they do not prove a booking, payment, treatment, or mutation completed, nor do they establish the state of the deployed website. The AI assistant provides information; clinical decisions belong to qualified professionals. See [media provenance](docs/media-guide.md).

## Contents

1. [Product overview](#product-overview)
2. [Role tours and GIFs](#role-tours-and-gifs)
3. [System architecture](#system-architecture)
4. [Business flows and data](#business-flows-and-data)
5. [AI assistant and safety boundaries](#ai-assistant-and-safety-boundaries)
6. [Run the project on a new machine](#run-the-project-on-a-new-machine)
7. [Technology, source map, and API](#technology-source-map-and-api)
8. [Testing and deeper documentation](#testing-and-deeper-documentation)
9. [Contributing and license](#contributing-and-license)

## Product overview

HealthCare supports a care journey across branches within one hospital model. Visitors can discover specialties, physicians, and care packages before selecting an appointment slot. Patients can follow appointments and post-visit information. Clinicians use a separate clinical portal. Administrators manage catalogs, content, accounts, and review queues that require an authorized human decision.

| Role | Journey in the application | Read next |
| --- | --- | --- |
| Visitor | Find branches, specialties, physicians, packages, articles, and a booking entry point | [Booking flow](docs/business-workflows.md#đặt-lịch-và-giữ-chỗ) |
| Patient | Review appointments, records, prescriptions, results, care plans, notifications, and AI conversations | [Patient portal](docs/project-overview.md#bệnh-nhân) |
| Clinician | Review a schedule and work with consultations, clinical entries, care plans, and articles | [Clinician portal](docs/project-overview.md#bác-sĩ) |
| Administrator | Manage catalogs, schedules, users, CMS, AI source review, and payment reconciliation | [Admin portal](docs/project-overview.md#quản-trị-viên) |

The branches in the data model belong to **one hospital model**. Their presence does not prove data isolation between independent hospital tenants. The backend checks record access against ownership and the relevant clinical relationship. The [project overview and terminology](docs/project-overview.md) describe the role boundaries.

## Role tours and GIFs

These four tours are recordings of real browser navigation against `localhost:3000` with synthetic demo data, converted to GIFs. They open screens only: they do not create appointments, send chat messages, change records, publish content, or approve payments. The [media guide](docs/media-guide.md) records routes, dimensions, limitations, and reproduction notes.

### Explore care

Home → Specialties → Physicians → Packages → Booking.

![Tour of public care discovery](docs/assets/repo-tours/public-tour.gif)

| Home | Specialties |
| --- | --- |
| ![Local demo home page](docs/assets/repo-tours/public-01.png) | ![Specialty listing](docs/assets/repo-tours/public-02.png) |
| **Physicians** | **Booking screen** |
| ![Physician listing](docs/assets/repo-tours/public-03.png) | ![Appointment booking interface](docs/assets/repo-tours/public-05.png) |

[Care packages](docs/assets/repo-tours/public-04.png) · [Home at a 390 px viewport](docs/assets/repo-tours/public-mobile.png)

### Patient portal

Dashboard → Appointments → Visit history → Prescriptions → AI assistant.

![Tour of the patient portal](docs/assets/repo-tours/patient-tour.gif)

| Overview | Appointments |
| --- | --- |
| ![Patient dashboard](docs/assets/repo-tours/patient-01.png) | ![Patient appointments](docs/assets/repo-tours/patient-02.png) |
| **Visit history** | **AI assistant** |
| ![Visit history](docs/assets/repo-tours/patient-03.png) | ![AI assistant interface](docs/assets/repo-tours/patient-05.png) |

[Prescriptions](docs/assets/repo-tours/patient-04.png)

### Clinician portal

Clinical workspace → Schedule → Consultations → Care plans → Articles.

![Tour of the clinician portal](docs/assets/repo-tours/doctor-tour.gif)

| Clinical workspace | Schedule |
| --- | --- |
| ![Clinician dashboard](docs/assets/repo-tours/doctor-01.png) | ![Clinician schedule](docs/assets/repo-tours/doctor-02.png) |
| **Consultations** | **Care plans** |
| ![Consultation list](docs/assets/repo-tours/doctor-03.png) | ![Care plans](docs/assets/repo-tours/doctor-04.png) |

[Articles](docs/assets/repo-tours/doctor-05.png)

### Administration portal

Operations → Physicians → Users → CMS → AI source review → Payment reconciliation.

![Tour of the administration portal](docs/assets/repo-tours/admin-tour.gif)

| Operations overview | Physician directory |
| --- | --- |
| ![Administration dashboard](docs/assets/repo-tours/admin-01.png) | ![Physician management](docs/assets/repo-tours/admin-02.png) |
| **CMS** | **Payment reconciliation** |
| ![CMS content management](docs/assets/repo-tours/admin-04.png) | ![Payment review queue](docs/assets/repo-tours/admin-06.png) |

[Users](docs/assets/repo-tours/admin-03.png) · [AI source review](docs/assets/repo-tours/admin-05.png)

## System architecture

**Next.js** provides the web UI and same-origin backend-for-frontend (BFF) routes. **Spring Boot** authenticates requests, enforces authorization, processes transactions, and owns business persistence as a modular monolith. A **FastAPI** service handles AI retrieval and generation behind the Core API. PostgreSQL stores business data; Redis supports rate limiting and realtime signals. File storage, scanning, and mail integrations depend on feature configuration.

~~~mermaid
flowchart TB
    Browser["Visitor / patient / clinician / admin"] --> UI["Next.js UI"]
    UI --> BFF["Same-origin BFF"]
    BFF -->|"Trusted HTTP + user session"| Core["Spring Boot · modular monolith"]
    Core -->|"Transactions and business data"| SQL[("PostgreSQL + Flyway")]
    Core -->|"Rate limits / realtime signals"| Redis[("Redis")]
    Core -->|"Service-authenticated HTTP"| AI["FastAPI · AI service"]
    Core -. "Feature enabled" .-> Object["MinIO / S3 + scanner"]
    Core -. "Configuration-dependent" .-> Mail["Mail / notification"]
    AI --> Local["Local RAG"]
    AI -. "Selected adapter" .-> Projection["Protected RAG projection"]
    AI -. "Policy + environment" .-> Provider["Remote provider"]
~~~

**Trust boundaries:** the browser never receives a service token; the BFF does not grant business permissions; Core still checks role and ownership. Dotted edges are conditional choices, not a claim that each integration runs on the public website. See the [layered architecture, Compose, and hosted diagrams](docs/architecture/system-overview.md) and [auth/BFF reference](docs/api-reference.md#xác-thực-và-phiên-trình-duyệt).

### Local topology

~~~mermaid
flowchart LR
    User["Browser localhost:3000"] --> Web["Frontend + BFF"]
    Web --> Api["Spring API"]
    Api --> DB[("PostgreSQL")]
    Api --> Cache[("Redis")]
    Api --> AI["FastAPI on internal network"]
    Api -. "Feature flag" .-> Files["MinIO + scanner"]
    Api -. "Local mail" .-> Inbox["Mailpit"]
~~~

The base Compose configuration publishes the AI port to loopback by default at `127.0.0.1:8000` while the AI service also joins an internal network; that ingress declaration does not itself create provider egress. Host ports can be changed in `.env`. Consult the [base Compose file](infrastructure/docker-compose.yml), [local demo overlay](infrastructure/docker-compose.local-demo.yml), and [deployment topology](docs/architecture/system-overview.md#deployment-local).

## Business flows and data

### Booking: hold a slot before confirmation

A user selects a slot. The backend validates the physician schedule and holds availability for a limited time within a transaction. An OTP must be confirmed before the appointment becomes `CONFIRMED`. Slot locking and PostgreSQL constraints address competing requests; disabling a UI button alone cannot prevent duplicate bookings.

~~~mermaid
sequenceDiagram
    actor Patient as Person booking
    participant Web as Browser / BFF
    participant Core as BookingService
    participant DB as PostgreSQL
    participant Mail as Email delivery
    Patient->>Web: Select physician, date, and slot
    Web->>Core: POST /appointments/hold
    Core->>DB: Transaction + slot lock + validation
    alt Invalid or occupied slot
        Core-->>Web: Reject / conflict
    else Valid hold
        Core->>DB: PENDING_CONFIRMATION + hold expiry
        Core->>Mail: Send OTP (outbox when enabled)
        Core-->>Web: Booking code and deadline
        Patient->>Web: Enter OTP
        Web->>Core: POST /appointments/confirm
        Core->>DB: Validate OTP, expiry, and state
        Core-->>Web: CONFIRMED when valid
    end
~~~

[BookingService](apps/backend/src/main/java/com/healthcare/appointment/service/BookingService.java), the [PostgreSQL slot locker](apps/backend/src/main/java/com/healthcare/appointment/service/PostgresAppointmentSlotLocker.java), and the [business-flow guide](docs/business-workflows.md#đặt-lịch-và-giữ-chỗ) are the authorities for precise branches and states.

### Core data relationships

This diagram selects relationships that explain the patient journey; the complete schema belongs to the [Flyway migrations](apps/backend/src/main/resources/db/migration). Optionality in a relationship does not grant data access.

~~~mermaid
erDiagram
    users o|--o| patient_profiles : account_binding
    users o|--o| doctors : account_binding
    doctors ||--o{ doctor_branches : assigned
    branches ||--o{ doctor_branches : hosts
    doctors ||--o{ doctor_specialties : has
    specialties ||--o{ doctor_specialties : includes
    patient_profiles ||--o{ appointments : books
    doctors ||--o{ appointments : attends
    appointments o|--o| medical_records : encounter
    medical_records o|--o{ prescriptions : treatment
    appointments ||--o| bank_transfer_payments : payment
    appointments ||--o{ patient_care_plans : follow_up
~~~

PostgreSQL owns appointments, clinical records, payments, conversation history, and CMS snapshots. Redis does not replace SQL. Object storage holds files, while linkage, permissions, and scan state remain Core responsibilities. See the [domain ERD and migration guide](docs/database/schema-overview.md).

### Decisions reserved for authorized people

| Situation | What governs a state change | Source |
| --- | --- | --- |
| Appointment | Hold, OTP, expiry, check-in, and cancellation follow slot and owner rules | [Booking lifecycle](docs/business-workflows.md#vòng-đời-cuộc-hẹn) |
| Bank transfer | Transaction references or webhooks enter a queue; approval or rejection follows policy and audit | [Payment flow](docs/business-workflows.md#thanh-toán-và-đối-soát) |
| CMS content | Draft and public snapshots are separate; publishing creates a version that clients reconcile | [CMS realtime](docs/architecture/cms-realtime.md) |
| Clinical AI sources | Revision/hash, approval, revocation, and expiry determine eligibility | [AI governance](docs/business-workflows.md#kiểm-duyệt-nguồn-ai) |

## AI assistant and safety boundaries

The public assistant is limited to suitable hospital information. Patient conversations have separate ownership, mode, consent, quota, and lifecycle rules. A generated response passes through Core source controls before provider use. Fixed emergency guidance is recognized after the owner check and before the current-mode/consent gate; it does not call a provider, but still passes through idempotency and commit control.

~~~mermaid
flowchart TB
    Request["Patient request"] --> Owner["Conversation owner"]
    Owner --> Emergency{"Emergency?"}
    Emergency -->|"Yes"| Fixed["Fixed guidance"]
    Emergency -->|"No"| Gate["Mode · consent · safety"]
    Gate -->|"Allowed"| Sources["Retrieve + source eligibility"]
    Gate -->|"Safety action"| Bounded["Bounded answer"]
    Sources -->|"Eligible source"| Answer["Generate + validate"]
    Sources -->|"No eligible source"| Bounded
    Fixed --> Commit["Idempotency + permit + commit"]
    Bounded --> Commit
    Answer --> Commit
    Commit --> History[("Conversation history")]
~~~

SSE or a typing effect does not, by itself, prove genuine provider token streaming. Public sources, the RAG projection, and private clinical data have distinct authorities. Read the [AI/RAG contract](docs/ai-system.md), [security guide](docs/security.md), and [AI service README](apps/ai-service/README.md).

## Run the project on a new machine

Install Git and Docker Engine with Compose v2. Running individual services outside Docker also requires Node/npm matching the [frontend engine declaration](apps/frontend/package.json), Java 21, and Python 3.12. From the repository root, fill every required server-only variable in `.env` before starting the stack.

~~~powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Fill required values using docs/getting-started.md.
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml config --quiet
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml up -d --build
docker compose -p healthcare-local-demo --env-file .env -f infrastructure/docker-compose.yml -f infrastructure/docker-compose.local-demo.yml ps
~~~

Do not run `up` while required secrets are empty or if the Compose project name collides with a stack whose data must be retained. The [getting-started guide](docs/getting-started.md) covers preflight checks, environment variables, health checks, and existing-stack protection.

| Default local endpoint | Purpose |
| --- | --- |
| [localhost:3000](http://localhost:3000) | Website and BFF |
| [localhost:8080/actuator/health](http://localhost:8080/actuator/health) | Backend health |
| [localhost:8025](http://localhost:8025) | Local Mailpit inbox |
| [localhost:9001](http://localhost:9001) | MinIO console |
| `localhost:5434` | Demo PostgreSQL host port |

Local seed accounts: `patient@healthcare.com`, `doctor@healthcare.com`, and `admin@healthcare.com`. Passwords and profile bindings are documented in the [demo runbook](docs/local-demo-runbook.md). Do not assume these accounts exist on the public website.

## Technology, source map, and API

| Component | Technology | Executable owner |
| --- | --- | --- |
| Web and BFF | Next.js 16, React, TypeScript, Tailwind | [Frontend package](apps/frontend/package.json), [route handlers](apps/frontend/app/api) |
| Core API | Spring Boot 3.5, Java 21, Security, JPA, Flyway | [Backend POM](apps/backend/pom.xml), [modules](apps/backend/src/main/java/com/healthcare) |
| AI service | FastAPI, Python 3.12, retrieval/provider adapters | [Requirements](apps/ai-service/requirements.txt), [application](apps/ai-service/app) |
| Data and local tools | PostgreSQL 16, Redis, MinIO, Mailpit, scanner/ClamAV | [Compose](infrastructure/docker-compose.yml) |
| CI and infrastructure | GitHub Actions, Docker images, conditional hosted configuration | [Workflows](.github/workflows), [operations guide](docs/operations.md) |

| Directory | Primary responsibility |
| --- | --- |
| [apps/frontend](apps/frontend) | UI, browser-facing API/BFF, and rendered tests |
| [apps/backend](apps/backend) | Business logic, access checks, migrations, and Java tests |
| [apps/ai-service](apps/ai-service) | AI routing, retrieval, generation, and Python tests |
| [infrastructure](infrastructure) | Compose, scanning, and local services |
| [supabase](supabase) | Configured projection/RLS and reconciliation |
| [docs](docs/README.md) | Guides and technical decisions |

The browser uses same-origin `/api/v1/*` routes, and the BFF forwards trusted requests to Spring. Controllers and services own the final methods, DTOs, and access rules; the table below is a map, not an API contract.

| API group | Owner | Boundary to check |
| --- | --- | --- |
| Auth and browser session | [AuthController](apps/backend/src/main/java/com/healthcare/auth/AuthController.java) | Cookie/CSRF differs from JWT APIs |
| Catalog and booking | [Hospital controllers](apps/backend/src/main/java/com/healthcare/hospital/controller), [AppointmentController](apps/backend/src/main/java/com/healthcare/appointment/controller/AppointmentController.java) | Public/role routes, hold, OTP, owner proof |
| Clinical and care plans | [Clinical controllers](apps/backend/src/main/java/com/healthcare/clinical/controller), [Care-plan controllers](apps/backend/src/main/java/com/healthcare/careplan/controller) | Patient/clinician linkage |
| Payments and CMS | [Payment controllers](apps/backend/src/main/java/com/healthcare/payment/controller), [CMS controllers](apps/backend/src/main/java/com/healthcare/cms/controller) | Audit, human review, published snapshots |
| Public and patient AI | [PublicAiChatController](apps/backend/src/main/java/com/healthcare/ai/controller/PublicAiChatController.java), [AiConversationController](apps/backend/src/main/java/com/healthcare/ai/chat/controller/AiConversationController.java) | Different surfaces, sources, and consent |

The [API reference](docs/api-reference.md) explains how to locate exact method/path/DTO ownership and distinguishes browser sessions, JWT, public APIs, role-gated APIs, and the internal control plane.

## Testing and deeper documentation

Run each command from its service directory after preparing the environment described in [Testing](docs/testing.md). These are reproduction routes, not a claim that every suite just passed.

| Component | Main commands | Where/when |
| --- | --- | --- |
| Frontend | `npm ci`, `npm run verify` | In `apps/frontend` |
| Backend | `.\mvnw.cmd -B verify` | In `apps/backend` after test preflight |
| AI | `python -m pytest`, `python -m ruff check .`, `python -m mypy` | In `apps/ai-service` with requirements installed |

| Topic | Start here |
| --- | --- |
| Installation and demo | [Getting started](docs/getting-started.md) · [local demo runbook](docs/local-demo-runbook.md) |
| Architecture and decisions | [System overview](docs/architecture/system-overview.md) · [ADR index](docs/adr/README.md) |
| Business flows and data | [Business workflows](docs/business-workflows.md) · [Database/ERD](docs/database/schema-overview.md) |
| API, sessions, and security | [API reference](docs/api-reference.md) · [Security](docs/security.md) |
| AI, sources, and consent | [AI system](docs/ai-system.md) · [AI service](apps/ai-service/README.md) |
| Testing and operations | [Testing](docs/testing.md) · [Operations](docs/operations.md) |
| Screenshots/GIFs and provenance | [Media guide](docs/media-guide.md) · [capture metadata](docs/assets/repo-tours/provenance.json) |

Most deeper handbook pages linked above are in Vietnamese; this English README provides the full repository-level route and links directly to their executable owners where precision matters.

## Contributing and license

Read the [contribution guide](docs/contributing.md) and [AGENTS.md](AGENTS.md) before changing the repository. State the environment and the checks actually run when proposing a change. The source is released under the [MIT License](LICENSE).
