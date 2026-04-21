-- CreateIndex
CREATE INDEX "ConnectionRequest_toUserId_status_idx" ON "ConnectionRequest"("toUserId", "status");

-- CreateIndex
CREATE INDEX "ConnectionRequest_fromUserId_status_idx" ON "ConnectionRequest"("fromUserId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "VaultConnection_userId_idx" ON "VaultConnection"("userId");
