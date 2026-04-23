-- AlterTable
ALTER TABLE "ScoreEntry" ADD COLUMN "isWinner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "role" TEXT,
ADD COLUMN "team" TEXT,
ADD COLUMN "rank" INTEGER,
ADD COLUMN "eliminationOrder" INTEGER;

-- AlterTable
ALTER TABLE "PlayedGame" ADD COLUMN "difficulty" TEXT,
ADD COLUMN "teams" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "teamScores" JSONB;

-- AlterTable
ALTER TABLE "GameTemplate" ADD COLUMN "trackEliminationOrder" BOOLEAN NOT NULL DEFAULT false;

-- Best-effort backfill: mark the highest-scored entry per existing PlayedGame as the winner.
-- Historical time/ranking/winCondition='low' rows may be incorrect; documented limitation.
UPDATE "ScoreEntry"
SET "isWinner" = true
WHERE id IN (
  SELECT DISTINCT ON ("playedGameId") id
  FROM "ScoreEntry"
  ORDER BY "playedGameId", score DESC, id
);
