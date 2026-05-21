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
HuggingFace Spaces 的容器是临时的，每次 Factory Rebuild 后本地数据会丢失。为了保留导入的单词数据，需要配置 HuggingFace Persistent Storage 作为持久化存储。

### 配置步骤

#### 1. 启用 Persistent Storage
1. 进入你的 Word Helper Space 页面
2. 点击顶部 `Settings` 标签
3. 向下滚动找到 `Hardware` 部分
4. 在 `Storage Buckets` 区域，点击 `Mount a bucket`
5. 填写配置：
   - Bucket name：`word-helper-storage`（或其他你喜欢的名称）
   - Mount path：`/data`（必须填写这个路径）
   - Access mode：`Read & Write`
6. 点击 `Mount bucket`

#### 2. 等待存储挂载
- 挂载完成后，Space 会自动重启一次
- 重启后数据库会自动保存到 `/data` 目录

#### 3. 验证配置
1. 等待 Space 重启完成
2. 查看 Space 日志，确认看到以下日志：
   ```
   [DB] Storage mode: Persistent Storage (/data)
   [DB] Loaded existing database from storage
   ```
3. 如果配置正确，数据会在 `/data` 目录持久化保存

### 工作原理
- **数据目录**：数据库保存到 `/data/word-helper.db`
- **持久化**：Persistent Storage 在 Factory Rebuild 后仍然保留数据
- **自动检测**：代码会自动检测 `/data` 目录是否存在，使用持久化存储

### 注意事项
- **不要上传到 HuggingFace Hub**：之前的 Hub 上传方案已被废弃，因为会导致 Space 无限重建
- **Persistent Storage 是官方推荐方案**：数据存储在独立的存储桶中，不影响 Space 构建
- **存储费用**：免费实例有一定存储额度，超出可能收费

---

## 四、数据备份与恢复

### 自动备份
数据自动保存在 Persistent Storage 中，每次修改都会立即持久化。

### 手动备份（通过 HuggingFace CLI）
```bash
# 安装 huggingface_hub
pip install huggingface_hub

# 登录
huggingface-cli login

# 下载数据库文件
huggingface-cli download CarlosShao/word-helper /data/word-helper.db --local-dir . --local-dir-use-symlinks False
```

### 手动恢复
1. 进入 Space 的 Storage 页面
2. 找到 `word-helper.db` 文件
3. 点击上传新的数据库文件

---

## 五、故障排除

### 问题1：数据仍然丢失
**检查项**：
- [ ] 是否已挂载 Persistent Storage？
- [ ] Mount path 是否为 `/data`？
- [ ] Space 日志中是否显示 `Persistent Storage (/data)`？

### 问题2：Storage Bucket 无法挂载
**检查项**：
- [ ] Bucket name 是否唯一？
- [ ] 账户是否有足够的存储额度？
- [ ] Access mode 是否设置为 `Read & Write`？

### 问题3：Space 无限重建
**原因**：之前使用 HuggingFace Hub 上传方案会触发重建
**解决**：已改用 Persistent Storage，不会再触发重建

---

## 六、最佳实践

1. **挂载后再导入数据**：先确保 Storage 已挂载，再导入单词数据
2. **定期验证**：偶尔 Factory Rebuild 后检查数据是否还在
3. **重要数据备份**：对于重要数据，可以使用 HuggingFace CLI 手动备份到本地
4. **监控日志**：部署后查看一次日志，确认存储模式正确
