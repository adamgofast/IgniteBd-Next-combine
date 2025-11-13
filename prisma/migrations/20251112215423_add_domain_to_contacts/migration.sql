-- Add domain column to contacts table
-- Domain is inferred from email address (e.g., joel@businesspointlaw.com -> businesspointlaw.com)
-- Used for enrichment and CompanyHQ association

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS domain TEXT;

-- Create index for domain lookups (useful for CompanyHQ association)
CREATE INDEX IF NOT EXISTS idx_contacts_domain ON contacts(domain) WHERE domain IS NOT NULL;
