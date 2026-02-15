# PostBridge Lite React Console

React 前端控制台，对接 `postbridge-lite` 后端。

## 项目位置

- `/Users/qiujingdediannao/Desktop/postbridge-lite-react`

## 本地开发

1. 启动后端 API（终端 A）

```bash
export TIKTOK_CLIENT_KEY="你的client_key"
export TIKTOK_CLIENT_SECRET="你的client_secret"
export TIKTOK_REDIRECT_URI="http://127.0.0.1:5173/tiktok/callback"

python3 /Users/qiujingdediannao/Aiagent-info/Aiagent-info/scripts/postbridge-lite.py serve --host 127.0.0.1 --port 8787
```

2. 启动前端（终端 B）

```bash
cd /Users/qiujingdediannao/Desktop/postbridge-lite-react
npm install
npm run dev
```

3. 浏览器访问

- `http://127.0.0.1:5173`
- OAuth 回调页：`http://127.0.0.1:5173/tiktok/callback`
- 服务条款页：`http://127.0.0.1:5173/terms`
- 隐私政策页：`http://127.0.0.1:5173/privacy`

## 部署到 Vercel（tiktok.athinker.net）

1. 在 Vercel 新建项目并导入此目录。  
2. 在 Vercel 环境变量添加：

- `VITE_API_BASE=https://你的后端域名`

3. 绑定自定义域名：`tiktok.athinker.net`。  
4. 本项目已包含 `vercel.json`，支持 SPA 路由（`/tiktok/callback` 刷新不 404）。

## Cloudflare 子域名配置

> 目标：让 `tiktok.athinker.net` 指向 Vercel。

1. Cloudflare -> `athinker.net` -> `DNS` -> `Add record`。
2. 新增：

- `Type`: `CNAME`
- `Name`: `tiktok`
- `Target`: `cname.vercel-dns.com`
- `Proxy status`: `DNS only`（灰云，先保证验证稳定）

3. 保存后，在 Vercel 的 Domain 页面点 `Verify`。  
4. 生效验证：

```bash
dig tiktok.athinker.net +short
```

结果应返回 `cname.vercel-dns.com`（或其解析结果）。

## TikTok OAuth 生产配置

在 TikTok Developer Portal 里：

- `Redirect URI` 填：`https://tiktok.athinker.net/tiktok/callback`
- `Terms of Service URL` 填：`https://tiktok.athinker.net/terms`
- `Privacy Policy URL` 填：`https://tiktok.athinker.net/privacy`

后端也要一致：

```bash
export TIKTOK_REDIRECT_URI="https://tiktok.athinker.net/tiktok/callback"
```

## 支持操作

- 检查 API 健康状态
- 生成 TikTok OAuth 授权链接
- 回调页自动读取 `code` 并换 token
- 刷新 token
- 创建 URL 发布任务 / 文件发布任务
- 导入 OpenClaw JSON 批量任务
- 触发 worker 执行
- 配置每日固定时间自动执行 worker
- 查看账号与任务状态列表

## 定时能力说明

前端“每日自动执行”会调用后端接口：

- `GET /api/v1/scheduler`
- `POST /api/v1/scheduler`

后端在 `serve` 进程内运行调度线程，因此需要保持后端服务常驻。

## 生产构建

```bash
npm run build
npm run preview
```
