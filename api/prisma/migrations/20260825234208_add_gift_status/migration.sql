-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('PENDING', 'BOUGHT', 'REFUNDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "gifts" ADD COLUMN     "status" "GiftStatus" NOT NULL DEFAULT 'BOUGHT';
