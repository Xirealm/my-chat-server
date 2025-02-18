import { PrismaClient } from "@prisma/client";

// 声明全局变量
declare global {
  var prisma: PrismaClient | undefined;
}

// 创建 Prisma 实例
export const prisma =
  global.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"],
  });

// 在开发环境下将 prisma 实例保存到 global 对象中
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
