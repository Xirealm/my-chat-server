# 复制依赖文件并安装
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# 复制所有文件并构建项目
COPY . .
RUN npm run build

# 生产环境镜像
FROM node:18-alpine

WORKDIR /app

# 仅复制生产所需文件
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# 安装 Prisma 客户端生成工具
RUN npm install -g prisma

# 生成 Prisma 客户端并应用迁移
RUN prisma generate
RUN prisma migrate deploy

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "run", "start:prod"]