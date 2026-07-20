-- Drop dangling Contact.companyId column (no @relation — legacy imprint field).
-- Tenant FK is crmId; prospect company FK is contactCompanyId.

DROP INDEX IF EXISTS "contacts_companyId_idx";

ALTER TABLE "contacts" DROP COLUMN IF EXISTS "companyId";
