-- AlterTable
ALTER TABLE "User" ADD COLUMN "connectToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_connectToken_key" ON "User"("connectToken");
