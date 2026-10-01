<h1 align="center">
  <img src="./public/icons/auto.svg" alt="CloudflareSub Logo" height="40" align="absmiddle" /> CloudflareSub
</h1>

<p align="center"><em>一个轻量化的优选IP订阅器</em></p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-2ea44f" alt="License MIT" />
  <img src="https://img.shields.io/badge/platform-Windows-0078D6" alt="Windows" />
  <img src="https://img.shields.io/badge/platform-macOS-111111" alt="macOS" />
  <img src="https://img.shields.io/badge/platform-Linux-FCC624?logo=linux&logoColor=black" alt="Linux" />
  <img src="https://img.shields.io/badge/runtime-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/status-active-00C853" alt="Status Active" />
</p>

## 功能特性

- 支持 `vmess`、`vless`、`trojan` 节点解析
- 支持 Base64 订阅文本自动展开
- 支持 `host[:port][#remark]` 格式的优选地址
- 结果写入 Workers KV，生成 `/sub/:id` 短链
- 相同输入自动去重；订阅记录长期保留，除非手动删除
- 支持 `SUB_ACCESS_TOKEN` 访问令牌保护
- 支持导出：Raw（Base64）/ Clash（YAML）/ Surge（文本）
- 当前浏览器按订阅名称保存历史版本，可复制旧链接或生成二维码

## 项目结构

```text
cloudflaresub/
├─ src/
│  ├─ worker.js      # Worker 入口（API + 订阅输出）
│  └─ core.js        # 解析/渲染核心函数（测试使用）
├─ public/           # 前端静态资源
├─ tests/smoke.mjs   # Smoke test
├─ wrangler.toml
└─ package.json
```

## 快速开始（Cloudflare 网页端）
```text
视频部署流程：https://youtu.be/E5PI0LsQ43M
```
下面按 Cloudflare Dashboard 流程操作，尽量不依赖命令行。

### 1) 准备代码

- 将本项目代码保存到自己的 GitHub 仓库
- 确认 `wrangler.toml` 中 `name`、`main`、`assets` 路径与项目一致

### 2) 在 Dashboard 创建 Worker

- 打开 Cloudflare Dashboard
- 进入 `Workers & Pages`
- 点击 `Create application` -> `Create Worker`
- 先创建一个 Worker（用于初始化项目）

### 3) 绑定到 GitHub 仓库（推荐）

- 在 `Workers & Pages` 点击 `Create` -> `Import a repository`
- 授权 GitHub，并选择仓库 `Wayne-sun85/cloudflaresub`
- 构建设置建议：
  - Framework preset: `None`
  - Build command: 留空
  - Build output directory: 留空
- 保存并开始部署

说明：这个项目是 Worker 项目，入口在 `src/worker.js`，静态资源在 `public/`。

### 4) 创建 KV Namespace

- 进入 `Storage & Databases` -> `KV`
- 点击 `Create namespace`
- 名称建议：`SUB_STORE`

### 5) 给 Worker 绑定 KV

- 回到 Worker 项目页面
- 进入 `Settings` -> `Bindings`
- 点击 `Add binding`，类型选择 `KV namespace`
- Variable name 填：`SUB_STORE`
- Namespace 选择上一步创建的 KV
- 保存并重新部署

### 6) 配置访问令牌 Secret

- 在 Worker 项目中进入 `Settings` -> `Variables`
- 在 `Secrets` 区域添加：
  - Key: `SUB_ACCESS_TOKEN`
  - Value: 你自定义的一串令牌
- 保存后重新部署

说明：
- 设置后，请求 `/sub/:id` 必须带 `?token=...`
- 不设置也可运行，但订阅链接没有二次访问保护

### 7) 验证线上服务

- 打开 Worker 域名（如 `https://<name>.<subdomain>.workers.dev`）
- 访问首页 `/`，应看到前端表单
- 在页面输入节点和优选地址，点击生成
- 拿到 `/sub/:id` 后测试：
  - `?target=raw&token=...`
  - `?target=clash&token=...`
  - `?target=surge&token=...`

### 8) 后续更新代码

- 如果你使用 GitHub 自动部署：直接 push 到对应分支，Cloudflare 会自动重新部署
- 如果你不用 GitHub 自动部署：可在 Dashboard 在线编辑器中修改后手动部署

## API 说明

### `POST /api/generate`

输入原始节点与优选地址，返回短链订阅。

请求体示例：

```json
{
  "nodeLinks": "vmess://...\nvless://...",
  "preferredIps": "104.16.1.2#HK\n104.17.2.3:2053#US",
  "namePrefix": "CF",
  "keepOriginalHost": true
}
```

字段说明：
- `nodeLinks`: 多行节点链接
- `preferredIps`: 多行优选地址，格式 `host[:port][#remark]`
- `namePrefix`: 节点名附加前缀
- `keepOriginalHost`: 是否保留原始 Host/SNI（默认 `true`）

返回示例（节选）：

```json
{
  "ok": true,
  "shortId": "AbC123xYz9",
  "urls": {
    "auto": "https://<worker>/sub/AbC123xYz9?token=...",
    "raw": "https://<worker>/sub/AbC123xYz9?target=raw&token=...",
    "clash": "https://<worker>/sub/AbC123xYz9?target=clash&token=...",
    "surge": "https://<worker>/sub/AbC123xYz9?target=surge&token=..."
  }
}
```

### `GET /sub/:id`

按 `target` 返回订阅内容：
- `target=raw`（默认）
- `target=clash`
- `target=surge`

示例：

```bash
curl "https://<worker>/sub/<id>?target=clash&token=<SUB_ACCESS_TOKEN>"
```

## 前端页面

根路径 `/` 提供网页表单（来自 `public/`）：
- 粘贴节点链接
- 粘贴优选 IP / 域名
- 生成并展示各客户端订阅链接
- 一键复制 / 生成二维码
- 为不同订阅填写不同名称；更新时沿用名称，历史版本会归入同一组


## 注意事项

- `src/worker.js` 当前是 KV 短链方案，不依赖 `SUB_LINK_SECRET`
- 新生成的订阅记录长期保留，除非手动删除。升级前生成的旧链接需要用相同内容再生成一次，才能去除原有的 7 天到期时间。
- 历史列表保存在当前浏览器的网站数据中；换设备、换浏览器或清除网站数据后，列表不会自动恢复。升级前在浏览器中生成过的链接不会自动出现在新列表中。
- Surge 导出当前仅包含 `vmess` / `trojan`

## License

MIT
