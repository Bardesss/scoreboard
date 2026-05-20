-- AlterTable
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;

-- Backfill: each user's display name = their linked me-player's name, else username.
UPDATE "User"
SET "displayName" = COALESCE(
  (SELECT p."name" FROM "Player" p WHERE p."linkedUserId" = "User"."id" LIMIT 1),
  "username"
)
WHERE "displayName" IS NULL;
