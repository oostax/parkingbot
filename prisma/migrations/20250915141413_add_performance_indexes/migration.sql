-- CreateIndex
CREATE INDEX "idx_user_telegram_id" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "idx_user_username" ON "User"("username");

-- CreateIndex
CREATE INDEX "idx_user_created_at" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "idx_favorites_user_id" ON "favorites"("user_id");

-- CreateIndex
CREATE INDEX "idx_favorites_parking_id" ON "favorites"("parking_id");

-- CreateIndex
CREATE INDEX "idx_hourly_parking_data_parking_id" ON "hourly_parking_data"("parking_id");

-- CreateIndex
CREATE INDEX "idx_hourly_parking_data_hour" ON "hourly_parking_data"("hour");

-- CreateIndex
CREATE INDEX "idx_hourly_parking_data_date" ON "hourly_parking_data"("date_updated");

-- CreateIndex
CREATE INDEX "idx_parking_stats_parking_id" ON "parking_stats"("parking_id");

-- CreateIndex
CREATE INDEX "idx_parking_stats_timestamp" ON "parking_stats"("timestamp");

-- CreateIndex
CREATE INDEX "idx_parking_stats_parking_timestamp" ON "parking_stats"("parking_id", "timestamp");
