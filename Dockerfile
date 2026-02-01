FROM node:alpine3.20

# 设置运行目录，建议不要直接在 /tmp，某些平台 /tmp 有特殊清理逻辑
WORKDIR /app

# 先复制 package.json 安装依赖，利用 Docker 缓存层
COPY package*.json ./
RUN npm install --production

# 复制其余代码
COPY . .

# 安装必要的系统组件
# 增加 libc6-compat 提高二进制文件兼容性
RUN apk update && \
    apk add --no-cache \
    openssl \
    curl \
    ca-certificates \
    gcompat \
    libc6-compat \
    iproute2 \
    coreutils \
    bash

# 确保端口暴露
EXPOSE 3000

# 赋予执行权限
RUN chmod -R 777 /app

CMD ["node", "index.js"]
