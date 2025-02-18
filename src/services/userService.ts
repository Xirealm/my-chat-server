import { prisma } from "../lib/prisma";

interface CreateUserData {
  username: string;
  phone: string;
  password: string;
}

export class UserService {
  async createUser(data: CreateUserData) {
    return prisma.user.create({
      data: {
        username: data.username,
        phone: data.phone,
        password: data.password, // 注意：实际应用中需要加密
      },
    });
  }

  async verifyUser(username: string, password: string) {
    // 查找用户
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { phone: username }, // 支持使用手机号登录
        ],
      },
    });

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    // 验证密码
    if (user.password !== password) {
      // 注意：实际应用中应该使用加密比较
      throw new Error("INVALID_PASSWORD");
    }

    // 更新用户状态和最后活跃时间
    return prisma.user.update({
      where: { id: user.id },
      data: {
        status: "online",
        lastActiveAt: new Date(),
      },
    });
  }
}
