CREATE TABLE job_positions (
    id UUID PRIMARY KEY,
    slug VARCHAR(180) NOT NULL UNIQUE,
    title VARCHAR(180) NOT NULL,
    department VARCHAR(120) NOT NULL,
    location VARCHAR(200) NOT NULL,
    employment_type VARCHAR(32) NOT NULL,
    summary VARCHAR(1200) NOT NULL,
    responsibilities VARCHAR(6000) NOT NULL,
    requirements VARCHAR(6000) NOT NULL,
    benefits VARCHAR(4000) NOT NULL,
    deadline DATE,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_job_positions_employment_type
        CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'))
);

CREATE TABLE job_applications (
    id UUID PRIMARY KEY,
    application_code VARCHAR(24) NOT NULL UNIQUE,
    job_position_id UUID NOT NULL REFERENCES job_positions(id) ON DELETE RESTRICT,
    full_name VARCHAR(160) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    years_experience INTEGER,
    cover_letter VARCHAR(4000) NOT NULL,
    resume_url VARCHAR(1000),
    privacy_consent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_job_applications_experience
        CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 60),
    CONSTRAINT ck_job_applications_status
        CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW', 'OFFERED', 'REJECTED', 'WITHDRAWN'))
);

CREATE INDEX idx_job_positions_open
    ON job_positions(active, deadline, featured);
CREATE INDEX idx_job_applications_job_created
    ON job_applications(job_position_id, created_at DESC);
CREATE INDEX idx_job_applications_status_created
    ON job_applications(status, created_at DESC);
CREATE INDEX idx_job_applications_email_lower
    ON job_applications(LOWER(email));
