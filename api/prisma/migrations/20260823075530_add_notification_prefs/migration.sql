-- AlterTable
ALTER TABLE "users" ADD COLUMN     "quietHoursEndHour" INTEGER,
ADD COLUMN     "quietHoursStartHour" INTEGER,
ADD COLUMN     "timezone" TEXT;
