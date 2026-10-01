const form = document.getElementById('generator-form');
const submitBtn = document.getElementById('submitBtn');
const fillDemoBtn = document.getElementById('fillDemoBtn');
const resultSection = document.getElementById('resultSection');
const warningBox = document.getElementById('warningBox');
const previewBody = document.getElementById('previewBody');

const autoUrl = document.getElementById('autoUrl');
const rawUrl = document.getElementById('rawUrl');
const clashUrl = document.getElementById('clashUrl');
const surgeUrl = document.getElementById('surgeUrl');
const emptyState = document.getElementById('emptyState');

const qrModal = document.getElementById('qrModal');
const qrCanvas = document.getElementById('qrCanvas');
const qrText = document.getElementById('qrText');
const closeQrModal = document.getElementById('closeQrModal');
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const subscriptionNames = document.getElementById('subscriptionNames');
const historyStorageKey = 'cloudflaresub:history:v1';

let subscriptionHistory = loadHistory();
renderHistory();

const demoVmess = [
  'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJkZW1vLXdzLXRscyIsCiAgImFkZCI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAicG9ydCI6ICI0NDMiLAogICJpZCI6ICIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLAogICJzY3kiOiAiYXV0byIsCiAgIm5ldCI6ICJ3cyIsCiAgInRscyI6ICJ0bHMiLAogICJwYXRoIjogIi93cyIsCiAgImhvc3QiOiAiZWRnZS5leGFtcGxlLmNvbSIsCiAgInNuaSI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAiZnAiOiAiY2hyb21lIiwKICAiYWxwbiI6ICJoMixodHRwLzEuMSIKfQ=='
].join('\n');

const demoIps = [
  '104.16.1.2#HK-01',
  '104.17.2.3#HK-02',
  '104.18.3.4:2053#US-Edge'
].join('\n');

fillDemoBtn.addEventListener('click', () => {
  document.getElementById('nodeLinks').value = demoVmess;
  document.getElementById('preferredIps').value = demoIps;
  document.getElementById('namePrefix').value = 'CF';
  document.getElementById('keepOriginalHost').checked = true;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  warningBox.classList.add('hidden');
  previewBody.innerHTML = '';

  const payload = {
    nodeLinks: document.getElementById('nodeLinks').value,
    preferredIps: document.getElementById('preferredIps').value,
    namePrefix: document.getElementById('namePrefix').value,
    keepOriginalHost: document.getElementById('keepOriginalHost').checked,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = '生成中...';

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || '生成失败');
    }

    autoUrl.value = data.urls.auto;
    rawUrl.value = data.urls.raw;
    document.getElementById('rocketUrl').value = data.urls.raw;
    clashUrl.value = data.urls.clash;
    surgeUrl.value = data.urls.surge;

    emptyState.classList.add('hidden');

    document.getElementById('statInputNodes').textContent = data.counts.inputNodes;
    document.getElementById('statEndpoints').textContent = data.counts.preferredEndpoints;
    document.getElementById('statOutputNodes').textContent = data.counts.outputNodes;

    previewBody.innerHTML = data.preview
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.type)}</td>
            <td>${escapeHtml(item.server)}</td>
            <td>${escapeHtml(String(item.port))}</td>
            <td>${escapeHtml(item.host || '-')}</td>
            <td>${escapeHtml(item.sni || '-')}</td>
          </tr>`,
      )
      .join('');

    if (Array.isArray(data.warnings) && data.warnings.length) {
      warningBox.textContent = data.warnings.join('\n');
      warningBox.classList.remove('hidden');
    }

    saveHistory({
      id: data.shortId,
      savedAt: new Date().toISOString(),
      name: document.getElementById('subscriptionName').value.trim() || '默认订阅',
      count: data.counts.outputNodes,
      urls: data.urls,
    });

    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    warningBox.textContent = error.message || '请求失败';
    warningBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '生成订阅';
  }
});

document.addEventListener('click', async (event) => {
  const historyButton = event.target.closest('[data-history-action]');
  if (historyButton) {
    const entry = subscriptionHistory[Number(historyButton.dataset.historyIndex)];
    const format = historyButton.parentElement.querySelector('select')?.value || 'raw';
    const url = entry?.urls?.[format];
    if (!url) return;
    if (historyButton.dataset.historyAction === 'copy') {
      try {
        await copyText(url, historyButton);
      } catch {
        warningBox.textContent = '复制失败，请打开二维码或刷新页面后重试。';
        warningBox.classList.remove('hidden');
      }
    } else if (historyButton.dataset.historyAction === 'qr') {
      showQr(url);
    }
    return;
  }

  const copyButton = event.target.closest('[data-copy-target]');
  if (copyButton) {
    const input = document.getElementById(copyButton.dataset.copyTarget);
    if (!input?.value) {
      return;
    }
    try {
      await copyText(input.value, copyButton);
    } catch {
      input.select();
      document.execCommand('copy');
    }
    return;
  }

  const qrButton = event.target.closest('[data-qrcode-target]');
  if (qrButton) {
    warningBox.classList.add('hidden');

    const input = document.getElementById(qrButton.dataset.qrcodeTarget);
    if (!input?.value) {
      warningBox.textContent = '请先生成订阅链接，再显示二维码。';
      warningBox.classList.remove('hidden');
      return;
    }

    showQr(input.value);
    return;
  }

  if (event.target.closest('[data-close-modal="true"]')) {
    closeQrDialog();
  }
});

closeQrModal.addEventListener('click', closeQrDialog);

function closeQrDialog() {
  qrModal.classList.add('hidden');
  qrModal.setAttribute('aria-hidden', 'true');
  qrCanvas.innerHTML = '';
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(historyStorageKey) || '[]');
    return Array.isArray(saved)
      ? saved.filter((item) => item && typeof item.id === 'string' && typeof item.urls?.raw === 'string')
      : [];
  } catch {
    return [];
  }
}

function saveHistory(entry) {
  const previous = subscriptionHistory.find((item) => item.id === entry.id && item.name === entry.name);
  if (previous) {
    // Reuse its original creation time when identical input is generated again.
    entry.savedAt = previous.savedAt;
  }
  subscriptionHistory = [entry, ...subscriptionHistory.filter((item) => item.id !== entry.id || item.name !== entry.name)];
  try {
    localStorage.setItem(historyStorageKey, JSON.stringify(subscriptionHistory));
  } catch {
    warningBox.textContent = '订阅已生成，但浏览器未能保存历史记录。请复制链接留存。';
    warningBox.classList.remove('hidden');
  }
  renderHistory();
}

function renderHistory() {
  historyEmpty.classList.toggle('hidden', subscriptionHistory.length > 0);
  const groups = new Map();
  subscriptionHistory.forEach((item, index) => {
    const name = item.name || '默认订阅';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({ item, index });
  });
  subscriptionNames.innerHTML = [...groups.keys()]
    .map((name) => `<option value="${escapeHtml(name)}"></option>`).join('');
  historyList.innerHTML = [...groups.entries()].map(([name, versions]) => `
    <div class="history-group">
      <h3>${escapeHtml(name)} <small>${versions.length} 个版本</small></h3>
      ${versions.map(({ item, index }, versionIndex) => {
        const date = new Date(item.savedAt);
        const dateLabel = Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString('zh-CN');
        return `<article class="history-item">
      <div>
        <strong>${versionIndex === 0 ? '最新版本' : '历史版本'}</strong>
        <p class="hint">${escapeHtml(dateLabel)} · ${escapeHtml(String(item.count || 0))} 个节点</p>
      </div>
      <div class="history-actions">
        <select aria-label="订阅格式">
          <option value="raw">Shadowrocket / 原始</option>
          <option value="clash">Clash</option>
          <option value="surge">Surge</option>
          <option value="auto">自动识别</option>
        </select>
        <button type="button" class="secondary small" data-history-action="copy" data-history-index="${index}">复制链接</button>
        <button type="button" class="secondary small" data-history-action="qr" data-history-index="${index}">二维码</button>
      </div>
    </article>`;
      }).join('')}
    </div>`
  ).join('');
}

async function copyText(value, button) {
  await navigator.clipboard.writeText(value);
  const originalText = button.textContent;
  button.textContent = '已复制';
  setTimeout(() => { button.textContent = originalText; }, 1200);
}

function showQr(value) {
  if (!window.QRCode) {
    warningBox.textContent = '二维码组件加载失败，请刷新页面后重试。';
    warningBox.classList.remove('hidden');
    return;
  }
  qrCanvas.innerHTML = '';
  qrText.textContent = value;
  qrModal.classList.remove('hidden');
  qrModal.setAttribute('aria-hidden', 'false');
  new window.QRCode(qrCanvas, {
    text: value,
    width: 220,
    height: 220,
    correctLevel: window.QRCode.CorrectLevel.M,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
