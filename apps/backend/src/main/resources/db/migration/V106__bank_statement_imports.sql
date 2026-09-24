-- Bank statement imports (nhập sao kê). Each batch records what was ingested
-- and how it matched; rows are deduplicated globally by a content hash so
-- re-importing the same file can never double-match a payment.
CREATE TABLE bank_statement_imports (
    id UUID PRIMARY KEY,
    file_name VARCHAR(200) NOT NULL,
    imported_by VARCHAR(255) NOT NULL,
    imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_rows INTEGER NOT NULL CHECK (total_rows >= 0),
    matched_rows INTEGER NOT NULL CHECK (matched_rows >= 0),
    duplicate_rows INTEGER NOT NULL CHECK (duplicate_rows >= 0),
    invalid_rows INTEGER NOT NULL CHECK (invalid_rows >= 0)
);

CREATE TABLE bank_statement_rows (
    id UUID PRIMARY KEY,
    import_id UUID NOT NULL,
    row_hash VARCHAR(64) NOT NULL UNIQUE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    transfer_content VARCHAR(64) NOT NULL,
    bank_reference VARCHAR(100),
    matched BOOLEAN NOT NULL DEFAULT FALSE,
    note VARCHAR(300),
    CONSTRAINT fk_bank_statement_rows_import
        FOREIGN KEY (import_id) REFERENCES bank_statement_imports (id) ON DELETE CASCADE
);

CREATE INDEX idx_bank_statement_rows_unmatched ON bank_statement_rows (import_id) WHERE matched = FALSE;
