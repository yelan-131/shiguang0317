// 时光剪存 - 弹窗逻辑

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const todayEl = document.getElementById('today');

  const { token, repo } = await chrome.storage.sync.get({
    token: '',
    repo: 'yelan-131/shiguang',
  });

  if (!token) {
    statusEl.textContent = '⚠️ 尚未配置 GitHub Token';
    statusEl.classList.add('err');
  } else {
    statusEl.textContent = `✓ 已连接 ${repo}`;
    statusEl.classList.add('ok');
  }

  // 今日剪存条数
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const stats = (await chrome.storage.local.get('stats')).stats || {};
  const n = stats[date] || 0;
  todayEl.textContent = n ? `今日已剪存 ${n} 条` : '今日还没有剪存';

  document.getElementById('options-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
