# 时光剪存 (Shiguang Clip) — Edge 浏览器插件

把网页中选中的**文字 / 图片 / 页面链接**右键剪存到 GitHub 私有仓库，**按日期归档为 Markdown**。

## 工作方式

| 内容 | 归档位置 |
|---|---|
| 选中文字 | `clippings/YYYY-MM-DD.md`（追加引用块 + 来源链接） |
| 图片 | `images/YYYY-MM-DD/<时间戳>.<ext>` + 当日 Markdown 追加 `![](...)` |
| 页面链接 | `clippings/YYYY-MM-DD.md`（追加链接条目） |

当日文件不存在则自动创建，标题为 `# 剪存 YYYY-MM-DD`，每条之间用 `---` 分隔，并带 `HH:MM` 时间戳和来源页面链接。

## 首次配置

1. **创建私有仓库**（剪存内容的存放地），如 `yelan-131/shiguang`
2. **创建 GitHub Token**：[Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens?type=beta)
   - Classic Token：勾选 `repo` 权限
   - Fine-grained Token：授权目标仓库，权限给 **Contents: Read and write**
3. Edge 打开 `edge://extensions/` → 开启「开发人员模式」→「加载解压缩的扩展」→ 选择本目录
4. 点击插件图标 → ⚙️ 设置 → 填入 Token、仓库（`owner/repo`）、归档目录 → 保存 → **测试连接**
5. 在任意网页选中文字 / 右键图片 → 「剪存到时光」✂️

## 项目结构

```
shiguang/
├── manifest.json    # 插件清单 (Manifest V3)
├── background.js    # 右键菜单 + GitHub API（追加归档/上传图片）
├── popup.html/js/css# 弹窗：连接状态 + 今日剪存数
├── options.html/js  # 设置页：Token / 仓库 / 归档目录 / 连接测试
└── icons/           # 图标 (16/32/48/128)
```

## 版本控制

- 插件代码仓库（本仓库）: https://github.com/yelan-131/shiguang0317
- 剪存内容仓库（插件写入，私有）: `yelan-131/shiguang`

## 说明

- Token 仅保存在浏览器 `chrome.storage.sync`（随账号同步，不落盘到剪存仓库）
- 图片以 base64 通过 GitHub Contents API 上传，单文件需 < 25 MB
- GitHub API 限流：Token 认证 5000 次/小时，正常剪存远够用

## 开发计划

- [x] 基础框架（Manifest V3 + popup + background + options）
- [x] 文字/图片/链接剪存，按日期归档 Markdown
- [ ] 批量剪存、标签分类
- [ ] popup 内浏览/搜索历史剪存
