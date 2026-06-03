/**
 * JSON Side - License Script
 *
 * 存储策略：书签存储
 * - 许可证存储在书签中（清除浏览数据默认不删书签）
 */

// 加密密钥
const ENCRYPT_KEY = 'JsonSide2024SecretKey';

// 书签标题
const BOOKMARK_TITLE = '.jsonside-license';

// 本地硬编码的激活码池（20个）
const LICENSE_POOL = [
  'JSIDE-A1B2-C3D4-E5F6',
  'JSIDE-G7H8-I9J0-K1L2',
  'JSIDE-M3N4-O5P6-Q7R8',
  'JSIDE-S9T0-U1V2-W3X4',
  'JSIDE-Y5Z6-A7B8-C9D0',
  'JSIDE-E1F2-G3H4-I5J6',
  'JSIDE-K7L8-M9N0-O1P2',
  'JSIDE-Q3R4-S5T6-U7V8',
  'JSIDE-W9X0-Y1Z2-A3B4',
  'JSIDE-C5D6-E7F8-G9H0',
  'JSIDE-I1J2-K3L4-M5N6',
  'JSIDE-O7P8-Q9R0-S1T2',
  'JSIDE-U3V4-W5X6-Y7Z8',
  'JSIDE-A9B0-C1D2-E3F4',
  'JSIDE-G5H6-I7J8-K9L0',
  'JSIDE-M1N2-O3P4-Q5R6',
  'JSIDE-S7T8-U9V0-W1X2',
  'JSIDE-Y3Z4-A5B6-C7D8',
  'JSIDE-E9F0-G1H2-I3J4',
  'JSIDE-K5L6-M7N8-O9P0'
];

/**
 * 简单加密（XOR + Base64）
 */
function encrypt(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(unescape(encodeURIComponent(result)));
}

/**
 * 简单解密
 */
function decrypt(encoded, key) {
  try {
    const text = decodeURIComponent(escape(atob(encoded)));
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (e) {
    return null;
  }
}

/**
 * 保存许可证到书签
 */
async function saveToBookmark(data) {
  try {
    const jsonStr = JSON.stringify(data);
    const encrypted = encrypt(jsonStr, ENCRYPT_KEY);
    const url = `data:text/plain;base64,${encrypted}`;

    const existing = await chrome.bookmarks.search({ title: BOOKMARK_TITLE });
    if (existing.length > 0) {
      await chrome.bookmarks.update(existing[0].id, { url });
    } else {
      await chrome.bookmarks.create({
        parentId: '2',
        title: BOOKMARK_TITLE,
        url: url
      });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 从书签读取许可证
 */
async function readFromBookmark() {
  try {
    const bookmarks = await chrome.bookmarks.search({ title: BOOKMARK_TITLE });
    if (bookmarks.length === 0) return null;

    const url = bookmarks[0].url;
    if (!url || !url.startsWith('data:text/plain;base64,')) return null;

    const encoded = url.substring('data:text/plain;base64,'.length);
    const decrypted = decrypt(encoded, ENCRYPT_KEY);
    if (!decrypted) return null;

    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}

/**
 * 显示结果
 */
function showResult(message, success) {
  const result = document.getElementById('result');
  if (!result) return;
  result.textContent = message;
  result.className = 'result ' + (success ? 'success' : 'error');
  result.style.display = 'block';
  setTimeout(() => { result.style.display = 'none'; }, 5000);
}

/**
 * 显示加载动画
 */
function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.add('active');
}

/**
 * 隐藏加载动画
 */
function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.remove('active');
}

/**
 * 显示成功动画（含粒子效果）
 */
function showSuccessAnimation() {
  return new Promise((resolve) => {
    const el = document.getElementById('successAnimation');
    if (!el) { resolve(); return; }

    // 生成粒子
    const colors = ['#4caf50', '#81c784', '#a5d6a7', '#ffb74d', '#fff176'];
    for (let i = 0; i < 16; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      const angle = (Math.PI * 2 * i) / 16;
      const distance = 60 + Math.random() * 40;
      particle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
      particle.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.left = '50%';
      particle.style.top = '45%';
      particle.style.animationDelay = Math.random() * 0.15 + 's';
      el.appendChild(particle);
    }

    el.classList.add('active');

    setTimeout(() => {
      el.classList.remove('active');
      // 清理粒子
      el.querySelectorAll('.particle').forEach(p => p.remove());
      resolve();
    }, 1200);
  });
}

/**
 * 显示 Pro 状态（显示激活码，等待用户输入确认激活）
 */
function showProStatus(data) {
  const status = document.getElementById('proStatus');
  const inputArea = document.getElementById('inputArea');

  if (status) status.classList.add('active');
  if (inputArea) inputArea.style.display = 'none';

  if (data) {
    const keyEl = document.getElementById('displayKey');
    if (keyEl) keyEl.textContent = data.licenseKey || '';
    // 默认隐藏激活码，显示掩码
    const maskEl = document.getElementById('displayKeyMask');
    if (keyEl && maskEl) {
      keyEl.classList.remove('revealed');
    }
  }

  // 点击显示/隐藏激活码
  const keyEl = document.getElementById('displayKey');
  const maskEl = document.getElementById('displayKeyMask');
  if (keyEl) {
    keyEl.onclick = () => { keyEl.classList.toggle('revealed'); };
  }
  if (maskEl) {
    maskEl.onclick = () => { if (keyEl) keyEl.classList.add('revealed'); };
  }

  // 绑定复制按钮
  const copyBtn = document.getElementById('copyKeyBtn');
  if (copyBtn && data) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(data.licenseKey || '');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      } catch (e) {
        copyBtn.textContent = 'Failed';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      }
    };
  }

  // 绑定确认激活按钮
  const confirmBtn = document.getElementById('confirmActivateBtn');
  const confirmInput = document.getElementById('licenseInputConfirm');
  if (confirmBtn && confirmInput) {
    confirmInput.value = '';
    confirmBtn.disabled = false;
    const btnText = document.getElementById('confirmBtnText');
    if (btnText) btnText.textContent = 'Activate';
    confirmBtn.style.background = '';
    confirmBtn.onclick = async () => {
      const inputKey = confirmInput.value.trim().toUpperCase();
      if (!inputKey) {
        showResult('Please enter the license key', false);
        return;
      }
      if (inputKey !== data.licenseKey) {
        showResult('License key does not match', false);
        return;
      }
      const saveResult = await saveToBookmark(data);
      if (saveResult.success) {
        // 显示进度条动画
        const btnLoader = document.getElementById('confirmBtnLoader');
        const btnText = document.getElementById('confirmBtnText');
        if (btnLoader) {
          btnLoader.style.display = 'block';
          btnLoader.style.width = '0%';
        }
        if (btnText) btnText.textContent = 'Activating...';
        confirmBtn.disabled = true;
        confirmInput.disabled = true;

        // 进度条从0%到100%动画
        const duration = 1000;
        const startTime = Date.now();
        await new Promise(resolve => {
          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            if (btnLoader) btnLoader.style.width = (progress * 100) + '%';
            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              resolve();
            }
          };
          requestAnimationFrame(animate);
        });

        if (btnLoader) btnLoader.style.display = 'none';
        if (btnText) btnText.textContent = '✓ Activated!';
        confirmBtn.style.background = '#4caf50';
      } else {
        showResult('Save failed: ' + saveResult.error, false);
      }
    };
  }

  // 绑定打赏按钮
  document.querySelectorAll('.donate-btn').forEach(btn => {
    btn.onclick = () => {
      const amount = btn.dataset.amount;
      let url = 'https://paypal.me/DevinDai';
      if (amount === '1') url = 'https://paypal.me/DevinDai/1';
      else if (amount === '2') url = 'https://paypal.me/DevinDai/2';
      else if (amount === '5') url = 'https://paypal.me/DevinDai/5';
      chrome.tabs.create({ url });
    };
  });
}

/**
 * 格式化时间
 */
function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 激活操作（本地随机领取激活码）
 */
async function activate() {
  const btn = document.getElementById('activateBtn');
  btn.disabled = true;

  // 显示加载动画
  showLoading();

  // 模拟生成过程
  await new Promise(r => setTimeout(r, 500));

  // 从激活码池中随机选择一个
  const randomIndex = Math.floor(Math.random() * LICENSE_POOL.length);
  const licenseKey = LICENSE_POOL[randomIndex];

  const licenseData = {
    licenseKey: licenseKey,
    activatedAt: new Date().toISOString(),
    version: 1
  };

  // 隐藏加载动画
  hideLoading();

  // 显示激活码，等待用户确认激活
  showProStatus(licenseData);
}

/**
 * 重新激活（清除书签，显示输入框）
 */
async function reactivate() {
  // 删除书签
  const existing = await chrome.bookmarks.search({ title: BOOKMARK_TITLE });
  for (const bookmark of existing) {
    await chrome.bookmarks.remove(bookmark.id);
  }

  // 显示输入区域
  const status = document.getElementById('proStatus');
  const inputArea = document.getElementById('inputArea');
  const activateBtn = document.getElementById('activateBtn');

  if (status) status.classList.remove('active');
  if (inputArea) inputArea.style.display = 'block';
  if (activateBtn) {
    activateBtn.disabled = false;
    activateBtn.textContent = 'Get License';
  }
}

/**
 * 显示已激活状态（从书签读取）
 */
function showAlreadyActivated(data) {
  const status = document.getElementById('proStatus');
  const inputArea = document.getElementById('inputArea');

  if (status) status.classList.add('active');
  if (inputArea) inputArea.style.display = 'none';

  const keyEl = document.getElementById('displayKey');
  if (keyEl) keyEl.textContent = data.licenseKey || '';

  // 已激活状态显示激活码
  const maskEl = document.getElementById('displayKeyMask');
  if (keyEl && maskEl) {
    keyEl.classList.add('revealed');
  }

  // 隐藏输入框和激活按钮
  const confirmInput = document.getElementById('licenseInputConfirm');
  if (confirmInput) confirmInput.style.display = 'none';

  const confirmBtn = document.getElementById('confirmActivateBtn');
  if (confirmBtn) {
    const btnText = document.getElementById('confirmBtnText');
    if (btnText) btnText.textContent = '✓ Activated!';
    confirmBtn.disabled = true;
    confirmBtn.style.background = '#4caf50';
  }

  // 绑定打赏按钮
  document.querySelectorAll('.donate-btn').forEach(btn => {
    btn.onclick = () => {
      const amount = btn.dataset.amount;
      let url = 'https://paypal.me/DevinDai';
      if (amount === '1') url = 'https://paypal.me/DevinDai/1';
      else if (amount === '2') url = 'https://paypal.me/DevinDai/2';
      else if (amount === '5') url = 'https://paypal.me/DevinDai/5';
      chrome.tabs.create({ url });
    };
  });
}

/**
 * 检查激活状态
 */
async function checkActivation() {
  const data = await readFromBookmark();
  if (data && data.licenseKey) {
    showAlreadyActivated(data);
    return true;
  }
  return false;
}

// 页面加载
document.addEventListener('DOMContentLoaded', async () => {
  await checkActivation();

  const activateBtn = document.getElementById('activateBtn');
  if (activateBtn) activateBtn.onclick = activate;
});
