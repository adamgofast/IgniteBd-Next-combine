-- Create Domain Registry table
-- Single source of truth for all company domains
-- Normalizes domains and links contacts + CompanyHQ records

CREATE TABLE IF NOT EXISTS "domain_registry" (
  "id" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "normalizedName" TEXT,
  "companyHqId" TEXT NOT NULL,
  "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeen" TIMESTAMP(3) NOT NULL,
  "confidenceScore" DOUBLE PRECISION DEFAULT 1.0,

  CONSTRAINT "domain_registry_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "domain_registry_domain_key" ON "domain_registry"("domain");
CREATE UNIQUE INDEX IF NOT EXISTS "domain_registry_companyHqId_key" ON "domain_registry"("companyHqId");

-- Create indexes
CREATE INDEX IF NOT EXISTS "domain_registry_domain_idx" ON "domain_registry"("domain");
CREATE INDEX IF NOT EXISTS "domain_registry_companyHqId_idx" ON "domain_registry"("companyHqId");

-- Add foreign key constraint
ALTER TABLE "domain_registry" ADD CONSTRAINT "domain_registry_companyHqId_fkey" 
  FOREIGN KEY ("companyHqId") REFERENCES "company_hqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
