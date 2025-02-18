/*
  Warnings:

  - You are about to drop the column `email` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `privateKey` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `publicKey` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `user` table. All the data in the column will be lost.
  - You are about to drop the `call` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `callparticipant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `filetransfer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `friendship` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `groupmember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `message` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phone` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `call` DROP FOREIGN KEY `Call_groupId_fkey`;

-- DropForeignKey
ALTER TABLE `call` DROP FOREIGN KEY `Call_initiatorId_fkey`;

-- DropForeignKey
ALTER TABLE `callparticipant` DROP FOREIGN KEY `CallParticipant_callId_fkey`;

-- DropForeignKey
ALTER TABLE `callparticipant` DROP FOREIGN KEY `CallParticipant_userId_fkey`;

-- DropForeignKey
ALTER TABLE `filetransfer` DROP FOREIGN KEY `FileTransfer_receiverId_fkey`;

-- DropForeignKey
ALTER TABLE `filetransfer` DROP FOREIGN KEY `FileTransfer_senderId_fkey`;

-- DropForeignKey
ALTER TABLE `friendship` DROP FOREIGN KEY `Friendship_user1Id_fkey`;

-- DropForeignKey
ALTER TABLE `friendship` DROP FOREIGN KEY `Friendship_user2Id_fkey`;

-- DropForeignKey
ALTER TABLE `group` DROP FOREIGN KEY `Group_ownerId_fkey`;

-- DropForeignKey
ALTER TABLE `groupmember` DROP FOREIGN KEY `GroupMember_groupId_fkey`;

-- DropForeignKey
ALTER TABLE `groupmember` DROP FOREIGN KEY `GroupMember_userId_fkey`;

-- DropForeignKey
ALTER TABLE `message` DROP FOREIGN KEY `Message_groupId_fkey`;

-- DropForeignKey
ALTER TABLE `message` DROP FOREIGN KEY `Message_receiverId_fkey`;

-- DropForeignKey
ALTER TABLE `message` DROP FOREIGN KEY `Message_senderId_fkey`;

-- DropIndex
DROP INDEX `User_email_key` ON `user`;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `email`,
    DROP COLUMN `privateKey`,
    DROP COLUMN `publicKey`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `phone` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `call`;

-- DropTable
DROP TABLE `callparticipant`;

-- DropTable
DROP TABLE `filetransfer`;

-- DropTable
DROP TABLE `friendship`;

-- DropTable
DROP TABLE `group`;

-- DropTable
DROP TABLE `groupmember`;

-- DropTable
DROP TABLE `message`;

-- CreateIndex
CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);

-- CreateIndex
CREATE UNIQUE INDEX `User_phone_key` ON `User`(`phone`);

-- CreateIndex
CREATE INDEX `User_phone_idx` ON `User`(`phone`);

-- CreateIndex
CREATE INDEX `User_username_idx` ON `User`(`username`);
