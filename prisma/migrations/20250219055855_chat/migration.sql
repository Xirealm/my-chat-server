/*
  Warnings:

  - You are about to drop the column `status` on the `message` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `message` DROP COLUMN `status`,
    ADD COLUMN `read` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `content` TEXT NOT NULL;
