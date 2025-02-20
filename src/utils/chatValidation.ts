import { PrismaClient } from '@prisma/client';

export async function validatePrivateChatMembers(
  prisma: PrismaClient,
  chatId: number,
) {
  const memberCount = await prisma.chatMember.count({
    where: {
      chatId: chatId,
      chat: {
        type: 'private',
      },
    },
  });

  if (memberCount !== 2) {
    throw new Error('Private chat must have exactly 2 members');
  }
}

export async function getPrivateChatMembers(
  prisma: PrismaClient,
  chatId: number,
) {
  const members = await prisma.chatMember.findMany({
    where: {
      chatId: chatId,
      chat: {
        type: 'private',
      },
    },
    include: {
      user: true,
    },
  });

  if (members.length !== 2) {
    throw new Error('Invalid private chat: must have exactly 2 members');
  }

  return members;
}
