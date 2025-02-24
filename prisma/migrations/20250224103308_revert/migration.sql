/*
  Warnings:

  - You are about to drop the `friendrequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `friendship` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `friendrequest` DROP FOREIGN KEY `FriendRequest_fromId_fkey`;

-- DropForeignKey
ALTER TABLE `friendrequest` DROP FOREIGN KEY `FriendRequest_toId_fkey`;

-- DropForeignKey
ALTER TABLE `friendship` DROP FOREIGN KEY `Friendship_friendId_fkey`;

-- DropForeignKey
ALTER TABLE `friendship` DROP FOREIGN KEY `Friendship_userId_fkey`;

-- DropTable
DROP TABLE `friendrequest`;

-- DropTable
DROP TABLE `friendship`;
