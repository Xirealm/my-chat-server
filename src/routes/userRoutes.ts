import { Router } from "express";
import { UserController } from "../controllers/userController";

const router = Router();
const userController = new UserController();

// 创建用户
router.post("/", userController.createUser);
// 用户登录
router.post("/login", userController.login);

export default router;
