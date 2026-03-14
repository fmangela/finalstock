# 后端 Docker 镜像构建文件
# 基于 node:20-alpine（轻量镜像，约 180MB）
# 只安装生产依赖（--only=production），不包含 devDependencies

FROM node:20-alpine

WORKDIR /app

# 先复制 package 文件并安装依赖，利用 Docker 层缓存
# 只有 package.json 变化时才重新 npm ci，源码变化不触发重装
COPY package*.json ./
RUN npm ci --only=production

# 复制源码
COPY src ./src

EXPOSE 3000

CMD ["node", "src/index.js"]
