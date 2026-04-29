-- CreateTable
CREATE TABLE "user_organizations" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "jobTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_organization_sectors" (
    "userOrganizationId" INTEGER NOT NULL,
    "sectorId" INTEGER NOT NULL,

    CONSTRAINT "user_organization_sectors_pkey" PRIMARY KEY ("userOrganizationId","sectorId")
);

-- Backfill organization memberships from the previous single-organization user fields.
INSERT INTO "user_organizations" (
    "userId",
    "organizationId",
    "role",
    "jobTitle",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "organizationId",
    "role",
    "jobTitle",
    "isActive",
    COALESCE("createdAt", CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM "users"
ON CONFLICT DO NOTHING;

-- Move sector access to the membership-specific access table.
INSERT INTO "user_organization_sectors" ("userOrganizationId", "sectorId")
SELECT
    "user_organizations"."id",
    "user_sectors"."sectorId"
FROM "user_sectors"
INNER JOIN "user_organizations"
    ON "user_organizations"."userId" = "user_sectors"."userId"
INNER JOIN "sectors"
    ON "sectors"."id" = "user_sectors"."sectorId"
    AND "sectors"."organizationId" = "user_organizations"."organizationId"
ON CONFLICT DO NOTHING;

-- Ensure users without explicit sector rows receive all sectors from their organization.
INSERT INTO "user_organization_sectors" ("userOrganizationId", "sectorId")
SELECT
    "user_organizations"."id",
    "sectors"."id"
FROM "user_organizations"
INNER JOIN "sectors"
    ON "sectors"."organizationId" = "user_organizations"."organizationId"
WHERE NOT EXISTS (
    SELECT 1
    FROM "user_organization_sectors"
    WHERE "user_organization_sectors"."userOrganizationId" = "user_organizations"."id"
)
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "user_organizations_userId_organizationId_key" ON "user_organizations"("userId", "organizationId");
CREATE INDEX "user_organizations_organizationId_idx" ON "user_organizations"("organizationId");

-- AddForeignKey
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_organization_sectors" ADD CONSTRAINT "user_organization_sectors_userOrganizationId_fkey" FOREIGN KEY ("userOrganizationId") REFERENCES "user_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_organization_sectors" ADD CONSTRAINT "user_organization_sectors_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old user-sector access table and single-organization user columns.
DROP TABLE IF EXISTS "user_sectors";

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_organizationId_fkey";
DROP INDEX IF EXISTS "users_organizationId_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "organizationId";
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
ALTER TABLE "users" DROP COLUMN IF EXISTS "jobTitle";
