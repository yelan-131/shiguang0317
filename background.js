// 时光剪存 - 后台 Service Worker (Manifest V3)
// 右键剪存选中文字/图片 → GitHub 私有仓库，按日期归档为 Markdown

const DEFAULTS = {
  token: '',
  repo: 'yelan-131/shiguang', // 剪存目标私有仓库
  folder: 'clippings',                   // Markdown 归档目录
};

// ===== 工具 =====
const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowStr = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function b64ToUtf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
  });
}

async function getConfig() {
  return chrome.storage.sync.get(DEFAULTS);
}

// ===== GitHub API =====
async function gh(path, options = {}) {
  const { token } = await getConfig();
  if (!token) {
    notify('未配置 Token', '请在扩展选项中配置 GitHub Personal Access Token');
    throw new Error('no token');
  }
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

// 追加一条剪存到当日 Markdown 文件（不存在则创建）
async function appendToDaily(entryMd) {
  const { repo, folder } = await getConfig();
  const date = todayStr();
  const path = `${folder}/${date}.md`;
  const apiUrl = `/repos/${repo}/contents/${encodeURI(path)}`;

  // 读取已有文件（404 = 当天第一条，新建）
  let sha;
  let existing = '';
  try {
    const file = await gh(apiUrl);
    sha = file.sha;
    existing = b64ToUtf8(file.content);
  } catch (e) {
    /* 文件不存在，走新建 */
  }

  const content = existing
    ? existing.replace(/\n+$/, '') + '\n\n---\n\n' + entryMd + '\n'
    : `# 剪存 ${date}\n\n` + entryMd + '\n';

  await gh(apiUrl, {
    method: 'PUT',
    body: JSON.stringify({
      message: `clip: ${date} ${nowStr()}`,
      content: utf8ToB64(content),
      sha,
    }),
  });

  // 记录当日剪存条数
  const stats = (await chrome.storage.local.get('stats')).stats || {};
  stats[date] = (stats[date] || 0) + 1;
  await chrome.storage.local.set({ stats });
}

// 获取页面标题（用于 Markdown 引用链接）
async function getTabTitle(tab) {
  try {
    if (tab && tab.title) return tab.title;
    if (tab && tab.id != null) {
      const t = await chrome.tabs.get(tab.id);
      return t.title || t.url;
    }
  } catch (e) { /* 忽略 */ }
  return '未知页面';
}

// ===== 剪存处理 =====
async function clipSelection(info, tab) {
  const text = (info.selectionText || '').trim();
  if (!text) return;
  const title = await getTabTitle(tab);
  const quoted = text.split('\n').map((l) => `> ${l}`).join('\n');
  await appendToDaily(`## ${nowStr()} [${title}](${info.pageUrl})\n\n${quoted}\n`);
}

async function clipImage(info, tab) {
  const { repo } = await getConfig();
  const url = info.srcUrl;
  if (!url) return;

  // 拉取图片并转 base64
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载图片失败: HTTP ${res.status}`);
  const blob = await res.blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  buf.forEach((b) => (bin += String.fromCharCode(b)));
  const b64 = btoa(bin);

  // 扩展名：优先 Content-Type，其次 URL
  const typeExt = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
  const ext = typeExt[blob.type] || (url.split('?')[0].split('.').pop() || 'png').toLowerCase();
  const name = `${Date.now()}.${ext}`;
  const imgPath = `images/${todayStr()}/${name}`;

  // 1. 上传图片
  await gh(`/repos/${repo}/contents/${encodeURI(imgPath)}`, {
    method: 'PUT',
    body: JSON.stringify({ message: `clip: image ${name}`, content: b64 }),
  });

  // 2. 在当日 Markdown 中追加引用
  const title = await getTabTitle(tab);
  await appendToDaily(`## ${nowStr()} [${title}](${info.pageUrl})\n\n![剪存图片](/${imgPath})\n`);
}

async function clipPage(info, tab) {
  const title = await getTabTitle(tab);
  await appendToDaily(`## ${nowStr()} 页面\n\n- [${title}](${info.pageUrl})\n`);
}

// ===== 右键菜单 =====
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'clip-selection', title: '✂️ 剪存选中文字到时光', contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'clip-image', title: '🖼️ 剪存这张图片到时光', contexts: ['image'] });
    chrome.contextMenus.create({ id: 'clip-page', title: '🔖 剪存本页链接到时光', contexts: ['page'] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'clip-selection') await clipSelection(info, tab);
    else if (info.menuItemId === 'clip-image') await clipImage(info, tab);
    else if (info.menuItemId === 'clip-page') await clipPage(info, tab);
    notify('剪存成功 ✓', `已归档到 ${todayStr()}.md`);
  } catch (e) {
    console.error('[时光剪存] 失败:', e);
    notify('剪存失败 ✗', String(e.message || e).slice(0, 180));
  }
});
