-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "blackTimeRemaining" INTEGER,
ADD COLUMN     "lastMoveAt" TIMESTAMP(3),
ADD COLUMN     "whiteTimeRemaining" INTEGER;
