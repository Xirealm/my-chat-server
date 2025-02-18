import { Request, Response } from "express";
import { UserService } from "../services/userService";

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  createUser = async (req: Request, res: Response) => {
    try {
      const { phone, username, password } = req.body;
      const user = await this.userService.createUser({
        phone,
        username,
        password,
      });

      // 201 Created 状态码表示资源创建成功
      res.status(201).json({
        code: 201,
        message: "用户创建成功",
        data: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          status: user.status,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        // 400 Bad Request - 客户端错误
        if (error.message.includes("Unique constraint")) {
          res.status(400).json({
            code: 400,
            message: "用户名或手机号已存在",
            error: "DUPLICATE_ENTRY",
          });
          return;
        }
      }

      // 500 Internal Server Error - 服务器错误
      console.error("创建用户失败:", error);
      res.status(500).json({
        code: 500,
        message: "服务器内部错误",
        error: "INTERNAL_SERVER_ERROR",
      });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      const user = await this.userService.verifyUser(username, password);

      // 200 OK - 登录成功
      res.status(200).json({
        code: 200,
        message: "登录成功",
        data: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          status: user.status,
          lastActiveAt: user.lastActiveAt,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        // 401 Unauthorized - 认证失败
        if (
          error.message === "USER_NOT_FOUND" ||
          error.message === "INVALID_PASSWORD"
        ) {
          res.status(401).json({
            code: 401,
            message: "用户名或密码错误",
            error: "AUTHENTICATION_FAILED",
          });
          return;
        }
      }

      // 500 Internal Server Error - 服务器错误
      console.error("登录失败:", error);
      res.status(500).json({
        code: 500,
        message: "服务器内部错误",
        error: "INTERNAL_SERVER_ERROR",
      });
    }
  };
}
