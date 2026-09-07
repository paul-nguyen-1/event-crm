-- CreateTable
CREATE TABLE "saved_gifts" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_gifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_gifts_contactId_idx" ON "saved_gifts"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_gifts_contactId_productId_key" ON "saved_gifts"("contactId", "productId");

-- AddForeignKey
ALTER TABLE "saved_gifts" ADD CONSTRAINT "saved_gifts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_gifts" ADD CONSTRAINT "saved_gifts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
