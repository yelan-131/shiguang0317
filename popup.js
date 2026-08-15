// 时光剪存 - 弹窗：浏览/搜索历史剪存
// 数据来自剪存仓库（GitHub Contents API），读取用 storage 中的 Token

const DEFAULTS = {
  token: '',
  repo: 'yelan-131/shiguang',
  folder: 'clippings',
};
const SEARCH_FILE_LIMIT = 50; // 搜索时最多拉取的日期文件数

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let cfg;

// ===== GitHub API =====
async function gh(path) {
  if (!cfg.token) throw new Error('未配置 Token，请点击右上角 ⚙️ 设置');
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

function b64ToUtf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

async function fetchDayFile(name) {
  const file = await gh(`/repos/${cfg.repo}/contents/${encodeURI(cfg.folder + '/' + name)}`);
  return b64ToUtf8(file.content);
}

// ===== 解析 =====
// 文件格式见 background.js：多条目以 --- 分隔，每条以 "## HH:MM [标题](链接)" 开头
function parseEntries(md) {
  const body = md.replace(/^# 剪存 [^\n]*\n/, '');
  return body
    .split(/\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => {
      const lines = text.split('\n');
      const head = lines[0] || '';
      const m = head.match(/^## (\d{2}:\d{2}) (?:\[([^\]]*)\]\((\S+?)\)|(.+))$/);
      return {
        time: m ? m[1] : '',
        title: m && m[2] !== undefined ? m[2] : m && m[4] ? m[4] : '剪存',
        url: m ? m[3] || '' : '',
        body: lines.slice(1).join('\n').trim(),
      };
    });
}

// ===== 渲染 =====
function showStatus(msg, isErr = false) {
  const s = $('status');
  s.textContent = msg;
  s.className = 'status' + (isErr ? ' err' : '');
}

function clearStatus() {
  $('status').className = 'status hidden';
}

function renderLoading(msg) {
  $('content').innerHTML = `<div class="empty">${esc(msg)}</div>`;
}

function renderEntry(entry, date) {
  const meta = `<div class="meta"><span class="time">${esc(entry.time || '--:--')}</span>${
    entry.url
      ? `<a href="${esc(entry.url)}" target="_blank" title="${esc(entry.title)}">${esc(entry.title)}</a>`
      : `<span title="${esc(entry.title)}">${esc(entry.title)}</span>`
  }${date ? `<span>${esc(date)}</span>` : ''}</div>`;

  let bodyHtml;
  const img = entry.body.match(/!\[[^\]]*\]\((\S+?)\)/);
  if (img) {
    // 图片剪存：经 API 取 base64 内联展示（私有仓库 raw 链接无法直接访问）
    bodyHtml = `<div class="body" data-img="${esc(img[1])}"><pre>🖼️ 图片加载中…</pre></div>`;
  } else {
    const text = entry.body.replace(/^> /gm, '');
    bodyHtml = `<div class="body"><pre>${esc(text)}</pre></div>`;
  }
  return `<div class="entry">${meta}${bodyHtml}</div>`;
}

async function loadThumb(container, imgPath) {
  try {
    const clean = imgPath.replace(/^\//, '');
    const file = await gh(`/repos/${cfg.repo}/contents/${encodeURI(clean)}`);
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = `data:image/png;base64,${file.content.replace(/\n/g, '')}`;
    container.innerHTML = '';
    container.appendChild(img);
  } catch (e) {
    container.querySelector('pre').textContent = `🖼️ 图片加载失败 (${e.message})`;
  }
}

function renderEntryList(entries, date) {
  if (!entries.length) {
    $('content').innerHTML = '<div class="empty">这一天还没有剪存</div>';
    return;
  }
  const html = entries.map((e) => renderEntry(e, date)).join('');
  const nav = date
    ? `<div class="navbar"><button class="back">← 返回日期列表</button><a href="https://github.com/${esc(cfg.repo)}/blob/main/${esc(cfg.folder)}/${esc(date)}.md" target="_blank">在 GitHub 查看 ↗</a></div>`
    : '';
  $('content').innerHTML = nav + html;

  if (date) $('content').querySelector('.back').addEventListener('click', loadDateList);

  // 触发图片缩略图加载
  $('content').querySelectorAll('.body[data-img]').forEach((el) => loadThumb(el, el.dataset.img));
}

// ===== 日期列表 =====
async function loadDateList() {
  clearStatus();
  renderLoading('加载中…');
  try {
    const files = await gh(`/repos/${cfg.repo}/contents/${encodeURI(cfg.folder)}`);
    const days = files
      .filter((f) => f.name.endsWith('.md'))
      .map((f) => f.name.replace(/\.md$/, ''))
      .sort()
      .reverse();
    if (!days.length) {
      $('content').innerHTML = '<div class="empty">还没有任何剪存<br>选中网页文字 → 右键 → 剪存到时光</div>';
      return;
    }
    $('content').innerHTML = days
      .map(
        (d) =>
          `<div class="date-item" data-date="${esc(d)}"><div class="date">📅 ${esc(d)}</div><div class="count">点击查看当日剪存</div></div>`
      )
      .join('');
    $('content').querySelectorAll('.date-item').forEach((el) =>
      el.addEventListener('click', () => loadDay(el.dataset.date))
    );
  } catch (e) {
    $('content').innerHTML = '';
    showStatus(e.message, true);
  }
}

async function loadDay(date) {
  clearStatus();
  renderLoading(`加载 ${date} …`);
  try {
    const entries = parseEntries(await fetchDayFile(date + '.md'));
    renderEntryList(entries, date);
  } catch (e) {
    $('content').innerHTML = '';
    showStatus(e.message, true);
  }
}

// ===== 搜索 =====
async function searchAll(query) {
  clearStatus();
  renderLoading(`搜索「${query}」中…`);
  const q = query.toLowerCase();
  try {
    const files = await gh(`/repos/${cfg.repo}/contents/${encodeURI(cfg.folder)}`);
    const days = files
      .filter((f) => f.name.endsWith('.md'))
      .map((f) => f.name.replace(/\.md$/, ''))
      .sort()
      .reverse()
      .slice(0, SEARCH_FILE_LIMIT);

    const hits = [];
    for (const d of days) {
      const entries = parseEntries(await fetchDayFile(d + '.md'));
      for (const e of entries) {
        if (`${e.title}\n${e.body}`.toLowerCase().includes(q)) hits.push({ ...e, _date: d });
      }
    }
    if (!hits.length) {
      $('content').innerHTML = `<div class="empty">没有匹配「${esc(query)}」的剪存${days.length >= SEARCH_FILE_LIMIT ? `（仅搜索最近 ${SEARCH_FILE_LIMIT} 天）` : ''}</div>`;
      return;
    }
    $('content').innerHTML = `<div class="navbar"><button class="back">← 返回日期列表</button><span>${hits.length} 条结果</span></div>` +
      hits.map((e) => renderEntry(e, e._date)).join('');
    $('content').querySelector('.back').addEventListener('click', loadDateList);
    $('content').querySelectorAll('.body[data-img]').forEach((el) => loadThumb(el, el.dataset.img));
  } catch (e) {
    $('content').innerHTML = '';
    showStatus(e.message, true);
  }
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', async () => {
  cfg = await chrome.storage.sync.get(DEFAULTS);
  $('options-btn').addEventListener('click', () => chrome.runtime.openOptionsPage());

  if (!cfg.token) {
    $('content').innerHTML =
      '<div class="empty">⚠️ 尚未配置 Token<br>点击右上角 ⚙️ 完成设置</div>';
    return;
  }
  loadDateList();

  $('search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) searchAll(q);
      else loadDateList();
    }
  });
});
