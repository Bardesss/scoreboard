-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allowAppearInOthers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicProfileMode" TEXT NOT NULL DEFAULT 'private';

-- CreateTable
CREATE TABLE "PlayedGameReaction" (
    "id" TEXT NOT NULL,
    "playedGameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayedGameReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayedGameReaction_playedGameId_idx" ON "PlayedGameReaction"("playedGameId");

-- CreateIndex
CREATE INDEX "PlayedGameReaction_userId_idx" ON "PlayedGameReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayedGameReaction_playedGameId_userId_emoji_key" ON "PlayedGameReaction"("playedGameId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "PlayedGameReaction" ADD CONSTRAINT "PlayedGameReaction_playedGameId_fkey" FOREIGN KEY ("playedGameId") REFERENCES "PlayedGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayedGameReaction" ADD CONSTRAINT "PlayedGameReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
