-- CreateTable
CREATE TABLE "FriendPrivacySetting" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "friendUserId" TEXT NOT NULL,
    "canViewLibrary" BOOLEAN NOT NULL DEFAULT true,
    "canBorrow" BOOLEAN NOT NULL DEFAULT true,
    "canViewActivity" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FriendPrivacySetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FriendPrivacySetting_ownerUserId_friendUserId_key" ON "FriendPrivacySetting"("ownerUserId", "friendUserId");

-- CreateIndex
CREATE INDEX "FriendPrivacySetting_friendUserId_idx" ON "FriendPrivacySetting"("friendUserId");

-- AddForeignKey
ALTER TABLE "FriendPrivacySetting" ADD CONSTRAINT "FriendPrivacySetting_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendPrivacySetting" ADD CONSTRAINT "FriendPrivacySetting_friendUserId_fkey" FOREIGN KEY ("friendUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
