CREATE TABLE specialties (
    id UUID PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(180) NOT NULL UNIQUE,
    description VARCHAR(2000),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE doctors (
    id UUID PRIMARY KEY,
    full_name VARCHAR(160) NOT NULL,
    slug VARCHAR(180) NOT NULL UNIQUE,
    bio VARCHAR(4000),
    photo_url VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE branches (
    id UUID PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(180) NOT NULL UNIQUE,
    address VARCHAR(500) NOT NULL,
    phone VARCHAR(50),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE services (
    id UUID PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(180) NOT NULL UNIQUE,
    description VARCHAR(2000),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE packages (
    id UUID PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(180) NOT NULL UNIQUE,
    description VARCHAR(2000),
    price NUMERIC(12,2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE articles (
    id UUID PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(220) NOT NULL UNIQUE,
    summary VARCHAR(500),
    body VARCHAR(8000),
    published_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE faqs (
    id UUID PRIMARY KEY,
    question VARCHAR(500) NOT NULL,
    answer VARCHAR(4000) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE doctor_specialties (
    id UUID PRIMARY KEY,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    specialty_id UUID NOT NULL REFERENCES specialties(id) ON DELETE RESTRICT,
    UNIQUE (doctor_id, specialty_id)
);

CREATE TABLE doctor_branches (
    id UUID PRIMARY KEY,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    UNIQUE (doctor_id, branch_id)
);

CREATE INDEX idx_specialties_active ON specialties(active);
CREATE INDEX idx_doctors_active ON doctors(active);
CREATE INDEX idx_branches_active ON branches(active);
CREATE INDEX idx_services_active ON services(active);
CREATE INDEX idx_packages_active ON packages(active);
CREATE INDEX idx_articles_active_published ON articles(active, published_at);
CREATE INDEX idx_faqs_active ON faqs(active);
