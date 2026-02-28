-- Enable pg_trgm extension if not exists for partial trigram matches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create Identity Email Trigram Index (Since email search is typically partial or domain-based)
CREATE INDEX idx_user_email_trgm ON users USING GIN (email gin_trgm_ops);

-- Create Identity Phone Trigram Index
CREATE INDEX idx_user_phone_trgm ON users USING GIN (phone gin_trgm_ops);

-- Create Vacancy FTS Index combining Job Title, Code, and Description
CREATE INDEX idx_vacancy_fts ON vacancies USING GIN (to_tsvector('simple', coalesce(job_title, '') || ' ' || coalesce(job_code, '') || ' ' || coalesce(job_description, '')));
