# Python Web Project

全栈 Web 应用模板，前后端分离开发，一键构建部署！

- **后端**：FastAPI + Uvicorn（Python）
- **前端**：React + Ant Design + TailwindCSS（TypeScript）
- **构建工具**：Rsbuild
- **任务编排**：[Task](https://taskfile.dev)

## 项目结构

```
├── server/          # 后端服务（FastAPI）
│   ├── server/
│   │   ├── app.py        # 应用入口
│   │   ├── router/       # 路由
│   │   ├── static/       # 静态文件（构建产物）
│   │   └── ...
│   └── pyproject.toml    # Python 依赖
├── web/             # 前端项目（React）
│   ├── src/
│   ├── package.json
│   └── rsbuild.config.ts
├── Taskfile.yml     # 任务配置
└── Readme.md
```

## 环境要求

| 工具 | 用途 | 安装 |
|------|------|------|
| [Task](https://taskfile.dev) | 任务运行器 | `npm i -g @go-task/cli` 或 [其他方式](https://taskfile.dev/installation) |
| [uv](https://docs.astral.sh/uv/) | Python 包管理 | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| [pnpm](https://pnpm.io) | 前端包管理 | `npm i -g pnpm` |
| Python | >= 3.14 | 通过 uv 自动管理 |
| Node.js | 前端运行时 | [nodejs.org](https://nodejs.org) |

## 快速开始

### 1. 安装依赖

```bash
# 一键安装前后端所有依赖
task install

# 或分别安装
task install-server   # 仅后端
task install-web      # 仅前端
```

### 2. 启动开发环境

```bash
task dev
```

这会同时启动：
- 后端服务：`http://localhost:8000`（FastAPI，支持热重载）
- 前端开发服务器：`http://localhost:3000`（Rsbuild，自动代理 `/api` 到后端）

也可以单独启动：

```bash
task frontend   # 仅启动前端
task backend    # 仅启动后端
```

### 3. 构建 & 生产模式

```bash
task start
```

该命令会将前端打包到 `server/server/static/` 目录，然后启动后端服务统一提供服务。

## 常用命令

| 命令 | 说明 |
|------|------|
| `task dev` | 启动开发环境（前后端同时启动） |
| `task install` | 安装所有依赖 |
| `task start` | 构建前端并启动生产服务 |
| `task stop` | 停止后端服务（强杀 8000 端口） |
| `task restart` | 重启后端服务 |
| `task build-web` | 仅构建前端 |

## 前端补充

```bash
cd web
pnpm run dev        # 启动开发服务器
pnpm run build      # 构建生产版本
pnpm run check      # Biome 代码检查
pnpm run format     # Biome 代码格式化
pnpm run api:gen    # 通过 Orval 生成 API 类型
```
