-- AlterTable
ALTER TABLE "GameTemplate" ADD COLUMN     "buyInCurrency" TEXT,
ADD COLUMN     "buyInEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#f5a623',
ADD COLUMN     "icon" TEXT NOT NULL DEFAULT '🎲',
ADD COLUMN     "maxPlayers" INTEGER,
ADD COLUMN     "minPlayers" INTEGER,
ADD COLUMN     "missions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "scoreFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "timeUnit" TEXT,
ADD COLUMN     "trackDifficulty" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trackTeamScores" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "winCondition" TEXT,
ADD COLUMN     "winType" TEXT NOT NULL DEFAULT 'points-all';

-- Backfill existing templates: points-all win type defaults to "high" win condition
UPDATE "GameTemplate" SET "winCondition" = 'high' WHERE "winType" = 'points-all';
