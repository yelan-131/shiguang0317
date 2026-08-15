# CLAUDE.md

时光剪存 —— Edge 浏览器插件（Manifest V3），把网页中选中的文字/图片右键剪存到 GitHub 私有仓库，按日期归档为 Markdown。

## 双仓库架构（勿混淆）

| 仓库 | 可见性 | 用途 |
|---|---|---|
| `yelan-131/shiguang0317` | 公开 | **本目录**，存放插件源码 |
| `yelan-131/shiguang` | 私有 | 剪存内容归档（插件运行时通过 API 写入） |

## 代码结构

- `manifest.json` — MV3 清单；权限：contextMenus / storage / notifications / tabs；host_permissions 含 `api.github.com` 和全站（抓取图片用）
- `background.js` — 核心：右键菜单注册、GitHub Contents API 调用、按日追加归档
- `popup.html/js/css` — 弹窗：连接状态 + 今日剪存条数（读 `chrome.storage.local.stats`）
- `options.html/js` — 设置页：Token / 仓库 / 归档目录 / 测试连接
- `icons/` — 16/32/48/128 PNG

## 关键实现约定

- 配置存 `chrome.storage.sync`（DEFAULTS 在 background.js 和 options.js 各有一份，**改默认仓库时两处都要同步**，popup.js 里还有第三份）
- 归档格式：`clippings/YYYY-MM-DD.md`，文件不存在时创建（标题 `# 剪存 YYYY-MM-DD`），已存在则 GET 取 sha 后 PUT 追加，条目间用 `---` 分隔
- 图片剪存：先 PUT base64 到 `images/YYYY-MM-DD/<时间戳>.<ext>`，再在当日 Markdown 追加 `![](/images/...)`
- base64 与 UTF-8 互转必须走 `utf8ToB64` / `b64ToUtf8`（含中文），不能直接 `btoa(str)`
- 日期时间均取**本地时区**（`todayStr()` / `nowStr()`）

## 环境与认证

- 本机 gh CLI 未安装；git 凭据管理器存的是 yelan-131 的 PAT
- 推送直接 `git push`（origin = https://github.com/yelan-131/shiguang0317.git）
- 调 GitHub API 可用：`printf 'protocol=https\nhost=github.com\n\n' | git credential fill` 取 token
- 插件内 Token 由用户在设置页粘贴（fine-grained PAT，Contents 读写），与 git 凭据相互独立

## 调试

- 加载/刷新插件：`edge://extensions/` → 开发人员模式 → 「加载解压缩的扩展」/ 重新加载
- Service Worker 日志：扩展页点「service worker」链接打开 DevTools
- 剪存失败先看通知气泡内容，再查 Service Worker 控制台 `[时光剪存]` 报错

## 已知待办

- [ ] 批量剪存、标签分类
- [ ] popup 内浏览/搜索历史剪存
