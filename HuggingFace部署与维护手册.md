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
1. 登录HuggingFace，进入`Spaces` → 点击`New Space`
2. 填写基础信息：
    - Space name：`word-helper`（与GitHub仓库同名）
    - SDK：选择`Docker`
    - 模板：**不选择任何模板**，直接往下滑
    - 硬件：默认`CPU Basic`（免费）
    - 可见性：`Public`
3. 直接点击`Create Space`，创建空白Space

### 3. 提交适配的Dockerfile
1. 进入Space页面 → 点击顶部`Files`标签
2. 点击右上角`+` → 选择`Create a new file`
3. 文件名填写`Dockerfile`（必须放在根目录，首字母大写）
4. 粘贴以下适配代码（已和项目完全匹配，无需修改）：
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

---

## 三、数据持久化配置（重要！）

### 为什么需要配置？
HuggingFace Spaces 的容器是临时的，每次 Factory Rebuild 后本地数据会丢失。为了保留导入的单词数据，需要配置 HuggingFace Hub 作为数据持久化存储。

### 配置步骤

#### 1. 获取 HuggingFace Token
1. 登录 [HuggingFace 官网](https://huggingface.co/)
2. 点击右上角头像 → `Settings`
3. 左侧菜单选择 `Access Tokens`
4. 点击 `New token`
5. 填写 Token 名称（如 `word-helper`）
6. 选择权限类型：`write`
7. 点击生成，**复制保存好 Token**（只会显示一次！）

#### 2. 在 Space 中配置 Token
1. 进入你的 Word Helper Space 页面
2. 点击顶部 `Settings` 标签
3. 向下滚动找到 `Repository secrets` 或 `Variables` 部分
4. 添加一个新的环境变量：
   - Name: `HF_TOKEN`
   - Value: 你刚才复制的 Token
5. 点击保存

#### 3. 验证配置
1. 等待 Space 自动重新构建（通常需要 1-2 分钟）
2. 查看 Space 日志，确认看到以下日志：
   ```
   [DB] Environment: HuggingFace
   [DB] HuggingFace Token: configured
   [DB] Downloading database from HuggingFace Hub...
   ```
3. 如果配置正确，每次数据保存都会自动上传到 HuggingFace Hub

### 工作原理
- **启动时**：从 HuggingFace Hub 下载最新的数据库文件
- **保存时**：同时保存到本地和上传到 HuggingFace Hub
- **Factory Rebuild 后**：自动从 Hub 恢复数据

### 注意事项
- Token 权限必须选择 `write`，否则无法上传数据
- 不要泄露 Token，防止他人访问你的数据
- 首次使用会创建新的数据库，导入数据后会自动保存
- 数据保存在你 Space 的仓库中，可以随时下载查看

---

## 四、数据恢复与备份

### 自动恢复
每次启动 Space 时，会自动从 HuggingFace Hub 下载最新的数据库。

### 手动备份
1. 进入 Space 仓库页面
2. 点击 `Files` 标签
3. 找到 `data/word-helper.db` 文件
4. 点击下载即可

### 手动恢复
如果需要恢复特定版本：
1. 下载需要的数据库版本
2. 通过 Space 的 API 上传（未来版本支持）

---

## 五、故障排除

### 问题1：数据仍然丢失
**检查项**：
- [ ] 是否配置了 `HF_TOKEN` 环境变量？
- [ ] Token 权限是否为 `write`？
- [ ] Space 日志中是否显示 `[DB] HuggingFace Token: configured`？

### 问题2：启动很慢
**原因**：首次启动需要从 Hub 下载数据库
**解决**：这是正常现象，后续启动会使用本地缓存

### 问题3：上传失败
**检查项**：
- [ ] Token 是否有效？
- [ ] Space 仓库是否公开？（私有仓库可能需要额外配置）
- [ ] 网络连接是否正常？

---

## 六、最佳实践

1. **定期检查**：偶尔查看 Space 日志，确认数据上传成功
2. **重要数据**：对于非常重要的数据，可以手动备份到本地
3. **避免频繁重建**：频繁 Factory Rebuild 会增加 Hub 负载
4. **监控日志**：部署后查看一次日志，确认配置正确
