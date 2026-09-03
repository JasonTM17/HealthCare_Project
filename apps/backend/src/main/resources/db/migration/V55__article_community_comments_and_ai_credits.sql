-- ==============================================================================
-- V55: Article community comments and AI credit system (Patient tiers & Doctor credits)
-- ==============================================================================

-- 1. Community Comments on Medical & Health Articles
CREATE TABLE IF NOT EXISTS article_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_slug VARCHAR(220) NOT NULL REFERENCES articles(slug) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(160) NOT NULL,
    author_role VARCHAR(24) NOT NULL, -- 'PATIENT', 'DOCTOR', 'ADMIN'
    content VARCHAR(2000) NOT NULL,
    parent_comment_id UUID REFERENCES article_comments(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_article_comment_content CHECK (
        char_length(btrim(content)) BETWEEN 1 AND 2000
    ),
    CONSTRAINT ck_article_comment_author_role CHECK (
        author_role IN ('PATIENT', 'DOCTOR', 'ADMIN')
    )
);

CREATE INDEX IF NOT EXISTS idx_article_comments_slug_created
    ON article_comments(article_slug, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_article_comments_author
    ON article_comments(author_user_id, created_at DESC);

-- 2. Patient Profile AI Tiers and Credits
ALTER TABLE patient_profiles
    ADD COLUMN IF NOT EXISTS patient_tier VARCHAR(24) NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN IF NOT EXISTS ai_credits INTEGER NOT NULL DEFAULT 20;

-- 3. Doctor Profile AI Credits
ALTER TABLE doctors
    ADD COLUMN IF NOT EXISTS ai_credits INTEGER NOT NULL DEFAULT 150;

-- 4. AI Credit Ledger / Transactions
CREATE TABLE IF NOT EXISTS ai_credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_role VARCHAR(24) NOT NULL, -- 'PATIENT', 'DOCTOR'
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    transaction_type VARCHAR(48) NOT NULL, -- 'ADMIN_GRANT', 'TIER_UPGRADE', 'AI_CHAT_USAGE', 'MONTHLY_REFILL'
    description VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_ai_credit_transaction_role CHECK (
        target_role IN ('PATIENT', 'DOCTOR')
    )
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_transactions_user
    ON ai_credit_transactions(user_id, created_at DESC);
