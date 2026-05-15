# 单词助手

帮助更好地学习和复习英语单词的应用。

## 功能特性

- PDF文件导入，自动识别单词、词性和中文释义
- 单词列表展示，支持分页和搜索
- 隐藏/显示中英文，方便背诵
- 随手拼写练习功能
- 错题集管理
- 昨日错词巩固
- 观察室单词复习

## 技术栈

- 前端：Vue 3 + Element Plus + Vite
- 后端：Node.js + Express + TypeScript
- 数据库：SQLite
- PDF解析：pdf-parse

## 快速开始

### 使用 Docker（推荐）

1. 构建并启动应用：
```bash
docker-compose up -d --build
```

2. 访问应用：
打开浏览器访问 http://localhost:3000

3. 停止应用：
```bash
docker-compose down
```

### 开发模式

#### 后端开发

```bash
cd backend
npm install
npm run dev
```

后端服务将在 http://localhost:3000 启动

#### 前端开发

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 http://localhost:5173 启动

## 使用说明

1. 导入单词：在首页上传包含单词表的PDF文件
2. 浏览单词：在单词列表中查看所有单词，可使用搜索功能
3. 隐藏显示：可以单独或批量隐藏/显示中英文
4. 随手拼写：进入随手拼页面，根据中文提示拼写英文单词
5. 错题复习：在错题集和昨日错词巩固页面复习错题

## 项目结构

```
.
├── backend/          # 后端代码
│   ├── src/
│   │   ├── index.ts      # 主入口文件
│   │   ├── db.ts         # 数据库配置
│   │   └── pdfParser.ts  # PDF解析
│   └── package.json
├── frontend/         # 前端代码
│   ├── src/
│   │   ├── views/        # 页面组件
│   │   ├── App.vue       # 根组件
│   │   ├── router.ts     # 路由配置
│   │   └── api.ts        # API接口
│   └── package.json
├── docker-compose.yml
└── Dockerfile
```
