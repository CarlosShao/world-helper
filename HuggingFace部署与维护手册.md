# HuggingFace部署与维护手册
本文档记录了项目在HuggingFace Spaces的部署、更新与维护全流程，避免重复踩坑。

---

## 一、项目说明
本项目为前后端分离的Node.js全栈项目，通过Docker多阶段构建部署在HuggingFace免费CPU实例上，实现公网可访问的在线服务，与本地电脑无关。

---

## 二、首次部署流程（纯网页操作，零本地修改）
### 1. 前置准备
- 确保GitHub项目仓库为**公开状态**，否则HuggingFace无法拉取代码
- 本地项目根目录已存在适配HuggingFace的`Dockerfile`（已写好，无需修改）

### 2. 新建空白Docker Space
1.  登录HuggingFace，进入`Spaces` → 点击`New Space`
2.  填写基础信息：
    - Space name：`word-helper`（与GitHub仓库同名）
    - SDK：选择`Docker`
    - 模板：**不选择任何模板**，直接往下滑
    - 硬件：默认`CPU Basic`（免费）
    - 可见性：`Public`
3.  直接点击`Create Space`，创建空白Space

### 3. 提交适配的Dockerfile
1.  进入Space页面 → 点击顶部`Files`标签
2.  点击右上角`+` → 选择`Create a new file`
3.  文件名填写`Dockerfile`（必须放在根目录，首字母大写）
4.  粘贴以下适配代码（已和项目完全匹配，无需修改）：
```dockerfile
# 阶段1：从GitHub拉取最新代码
FROM alpine/git AS clone
WORKDIR /app
RUN git clone https://github.com/CarlosShao/world-helper.git .

# 阶段2：构建前端
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY --from=clone /app/frontend/package*.json ./
RUN npm install
COPY --from=clone /app/frontend/ ./
RUN npm run build

# 阶段3：构建后端
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY --from=clone /app/backend/package*.json ./
RUN npm install
COPY --from=clone /app/backend/ ./
RUN npm run build

# 阶段4：生产运行（适配HuggingFace端口要求）
FROM node:20-alpine
WORKDIR /app

# 复制构建产物
COPY --from=backend-build /app/backend/package*.json ./
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=frontend-build /app/frontend/dist ./public

# 创建必要目录
RUN mkdir -p uploads data

# HuggingFace强制配置：端口+绑定主机
ENV PORT=7860
ENV HOST=0.0.0.0
EXPOSE 7860

# 启动命令
CMD ["node", "dist/index.js"]
```

### 重新编译

- `settings`->找到`Factory rebuild`, 项目就重新编译了, 只要github上的代码是最新的, 那这个项目就会保持最新