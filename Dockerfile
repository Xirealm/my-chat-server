# 使用 Node 官方镜像作为基础镜像
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件并安装
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# 复制所有文件并构建项目 
COPY . .
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "run", "start:prod"]