# MC Server Dashboard

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](https://expressjs.com/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

基于 Web 的 Minecraft 服务器监控面板，提供系统资源实时监控、MC 服务管理和 RCON 远程控制台。

深色终端风格 UI，响应式布局，适配桌面和移动端。支持 Windows / Linux / macOS。

## 功能特性

### 系统监控
- **CPU** — 实时使用率、温度、各核心负载，历史折线图
- **内存** — 使用量/总量、百分比，历史折线图
- **磁盘** — 所有分区独立显示，容量及使用率
- **GPU** — 使用率、温度、显存占用，历史折线图（自动过滤虚拟显示适配器）
- **网络** — 各网卡实时上下行速率及累计流量

### 进程管理
- Top 30 用户进程（自动过滤系统进程）
- 按 CPU / 内存 / PID / 名称排序
- 一键终止进程

### Minecraft 服务器控制
- 启动 / 停止 MC 服务
- 实时服务状态指示（Running / Stopped）
- RCON 远程控制台，发送命令并查看返回

### 跨平台服务管理

| 平台 | MC 服务管理 | 进程终止 | Dashboard 部署 |
|------|------------|---------|---------------|
| **Windows** | NSSM + `sc query` | `taskkill` | NSSM 服务 |
| **Linux / macOS** | PM2 / systemctl | `kill -9` | PM2 |

### 安全
- 密码登录，JWT Token 认证（24 小时有效期）
- 所有 API 端点均需 Bearer Token

## 快速开始

### 1. 安装依赖

```bash
# pnpm (推荐)
pnpm install

# 或 npm
npm install
```

### 2. 创建配置文件

```bash
cp config.example.json config.json
```

编辑 `config.json`：

```json
{
  "dashboardPort": 25566,
  "password": "your-dashboard-password",
  "jwtSecret": "change-this-to-a-random-string",
  "rcon": {
    "host": "127.0.0.1",
    "port": 25575,
    "password": "your-rcon-password"
  },
  "mcServiceName": "MC",
  "serverPropertiesPath": "/path/to/your/server.properties"
}
```

### 3. 启动

```bash
node server.js
```

浏览器打开 `http://localhost:25566`。

## 配置说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `dashboardPort` | number | Web 服务监听端口 |
| `password` | string | 面板登录密码 |
| `jwtSecret` | string | JWT 签名密钥，务必修改为随机字符串 |
| `rcon.host` | string | RCON 服务地址，通常为 `127.0.0.1` |
| `rcon.port` | number | RCON 端口，默认 `25575` |
| `rcon.password` | string | RCON 密码，如不填则从 `serverPropertiesPath` 自动读取 |
| `mcServiceName` | string | 服务名称（NSSM 服务名 / PM2 进程名 / systemd 单元名） |
| `serverPropertiesPath` | string | MC `server.properties` 文件路径 |

## 部署为后台服务

### Windows (NSSM)

使用 [NSSM](https://nssm.cc/)，以管理员身份运行 `install-service.bat`，或手动执行：

```bat
nssm install MCDashboard "C:\Program Files\nodejs\node.exe" "D:\path\to\server.js"
nssm set MCDashboard AppDirectory "D:\path\to\project"
nssm set MCDashboard DisplayName "MC Dashboard"
nssm set MCDashboard Start SERVICE_AUTO_START
nssm start MCDashboard
```

常用命令：
```bat
nssm restart MCDashboard
nssm stop MCDashboard
nssm remove MCDashboard confirm
```

### Linux / macOS (PM2)

```bash
# 安装 PM2
npm install -g pm2

# 启动 Dashboard
pm2 start ecosystem.config.js

# 开机自启
pm2 startup
pm2 save

# 常用命令
pm2 restart mc-dashboard
pm2 stop mc-dashboard
pm2 logs mc-dashboard
```

如果你的 MC 服务器也用 PM2 管理，在 `config.json` 中将 `mcServiceName` 设为 PM2 中的进程名即可直接控制。

## API 接口

所有接口（除登录外）需携带请求头 `Authorization: Bearer <token>`。

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/login` | POST | 登录，返回 JWT Token |
| `/api/system` | GET | 系统信息（CPU / 内存 / 磁盘 / 网络 / GPU） |
| `/api/mc/status` | GET | MC 服务状态 |
| `/api/mc/start` | POST | 启动 MC 服务 |
| `/api/mc/stop` | POST | 停止 MC 服务 |
| `/api/mc/rcon` | POST | 发送 RCON 命令 |
| `/api/processes` | GET | 获取进程列表（Top 30，已过滤系统进程） |
| `/api/processes/kill` | POST | 终止指定 PID 进程 |

## 项目结构

```
├── server.js              # Express 后端（平台无关）
├── platform/
│   ├── index.js           # 自动选择平台模块
│   ├── windows.js         # Windows: NSSM + sc + taskkill
│   └── linux.js           # Linux/macOS: PM2 + systemctl + kill
├── public/
│   └── index.html         # 前端单页面（内联 CSS/JS）
├── config.json            # 运行配置（不纳入版本控制）
├── config.example.json    # 配置模板
├── ecosystem.config.js    # PM2 配置文件
├── install-service.bat    # Windows NSSM 安装脚本
├── package.json
└── pnpm-lock.yaml
```

## 技术栈

- **后端**: [Express.js](https://expressjs.com/) + [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken)
- **系统信息**: [systeminformation](https://github.com/sebhildebrandt/systeminformation)
- **RCON**: [rcon-client](https://github.com/janispritzkau/rcon-client)
- **前端图表**: [Chart.js](https://www.chartjs.org/) (CDN)
- **服务管理**: [NSSM](https://nssm.cc/) (Windows) / [PM2](https://pm2.keymetrics.io/) (Linux/macOS)

## 前置要求

- Node.js >= 18
- MC `server.properties` 中已启用 RCON：
  ```properties
  enable-rcon=true
  rcon.port=25575
  rcon.password=your-password
  ```

**Windows 额外要求：**
- [NSSM](https://nssm.cc/) 已安装并加入 PATH
- MC 服务器已通过 NSSM 注册为 Windows 服务

**Linux / macOS 额外要求：**
- [PM2](https://pm2.keymetrics.io/) 已全局安装（`npm i -g pm2`）
- MC 服务器已通过 PM2 管理，或通过 systemd 注册为服务

## License

MIT
