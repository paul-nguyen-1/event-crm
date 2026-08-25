-- AlterTable
ALTER TABLE "events" ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "gifts" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "occasion" TEXT NOT NULL,
    "giftDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "costCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gifts_contactId_idx" ON "gifts"("contactId");

-- AddForeignKey
ALTER TABLE "gifts" ADD CONSTRAINT "gifts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
