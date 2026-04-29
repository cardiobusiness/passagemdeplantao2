-- CreateTable
CREATE TABLE "user_sectors" (
    "userId" INTEGER NOT NULL,
    "sectorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sectors_pkey" PRIMARY KEY ("userId","sectorId")
);

-- Backfill existing users with access to all existing sectors in their organization.
INSERT INTO "user_sectors" ("userId", "sectorId", "createdAt")
SELECT
    "users"."id",
    "sectors"."id",
    CURRENT_TIMESTAMP
FROM "users"
INNER JOIN "sectors" ON "sectors"."organizationId" = "users"."organizationId"
ON CONFLICT DO NOTHING;

-- AddForeignKey
ALTER TABLE "user_sectors" ADD CONSTRAINT "user_sectors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_sectors" ADD CONSTRAINT "user_sectors_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
