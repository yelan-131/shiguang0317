// 时光剪存 - 选项页逻辑

const DEFAULTS = {
  token: '',
  repo: 'yelan-131/shiguang',
  folder: 'clippings',
};

const $ = (id) => document.getElementById(id);

async function load() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  $('token').value = cfg.token;
  $('repo').value = cfg.repo;
  $('folder').value = cfg.folder;
}

async function save() {
  const cfg = {
    token: $('token').value.trim(),
    repo: $('repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''),
    folder: $('folder').value.trim().replace(/^\/+|\/+$/g, '') || 'clippings',
  };
  await chrome.storage.sync.set(cfg);
  const s = $('status');
  s.className = 'ok';
  s.textContent = '✓ 已保存';
}

async function test() {
  const s = $('status');
  s.className = '';
  s.textContent = '测试中…';
  try {
    const { token, repo } = await chrome.storage.sync.get(DEFAULTS);
    const t = $('token').value.trim() || token;
    const r = $('repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '') || repo;
    if (!t) throw new Error('请先填写 Token');
    const res = await fetch(`https://api.github.com/repos/${r}`, {
      headers: {
        Authorization: `Bearer ${t}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${(await res.text()).slice(0, 150)}`);
    const data = await res.json();
    s.className = 'ok';
    s.textContent = `✓ 连接成功\n仓库: ${data.full_name}（${data.private ? '私有' : '公开'}）\n默认分支: ${data.default_branch}\n权限: ${data.permissions?.push ? '可推送 ✓' : '只读 ✗（Token 缺少写入权限）'}`;
  } catch (e) {
    s.className = 'err';
    s.textContent = `✗ ${e.message}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  $('save').addEventListener('click', save);
  $('test').addEventListener('click', test);
});
