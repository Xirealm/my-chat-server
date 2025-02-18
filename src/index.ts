import express from "express";
import cors from "cors";
import userRoutes from "./routes/userRoutes";

import { prisma } from "./lib/prisma";
// import { userService } from "./services/UserService";

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use("/api/users", userRoutes);

// 在服务器启动时测试数据库连接
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
