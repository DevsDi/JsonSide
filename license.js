/**
 * JSON Side - License 激活脚本
 *
 * 存储策略：书签存储
 * - 许可证存储在书签中（清除浏览数据默认不删书签）
 */

// API 地址
const API_BASE = 'https://devcloud.buzz/notes/api';

// 加密密钥
const ENCRYPT_KEY = 'JsonSide2024SecretKey';

// 书签标题
const BOOKMARK_TITLE = '.jsonside-license';

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

    // 检查是否已存在
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
 * 获取或创建设备 UUID
 */
async function getDeviceId() {
  try {
    const result = await chrome.storage.local.get('deviceId');
    if (result.deviceId) return result.deviceId;

    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

    await chrome.storage.local.set({ deviceId: uuid });
    return uuid;
  } catch (e) {
    return 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  }
}

/**
 * 在线激活
 */
async function activateLicenseOnline(licenseKey, deviceId) {
  try {
    const response = await fetch(`${API_BASE}/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        device_id: deviceId
      })
    });
    return await response.json();
  } catch (e) {
    return { success: false, error: '网络错误，请稍后重试' };
  }
}

/**
 * 验证激活码格式
 */
function validateLicenseFormat(key) {
  const normalized = key.trim().toUpperCase();
  const pattern = /^JSIDE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!pattern.test(normalized)) {
    return { valid: false, reason: '激活码格式不正确' };
  }
  return { valid: true, key: normalized };
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
 * 显示 Pro 状态
 */
function showProStatus(data) {
  const status = document.getElementById('proStatus');
  const inputArea = document.getElementById('inputArea');

  if (status) status.classList.add('active');
  if (inputArea) inputArea.style.display = 'none';

  if (data) {
    const keyEl = document.getElementById('displayKey');
    const dateEl = document.getElementById('displayDate');
    if (keyEl) keyEl.textContent = data.licenseKey || '';
    if (dateEl) dateEl.textContent = formatTime(data.activatedAt);
  }
}

/**
 * 格式化时间
 */
function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 激活操作
 */
async function activate() {
  const input = document.getElementById('licenseInput');
  const btn = document.getElementById('activateBtn');
  const key = input.value.trim();

  if (!key) {
    showResult('请输入激活码', false);
    return;
  }

  btn.disabled = true;
  btn.textContent = '验证中...';

  const formatResult = validateLicenseFormat(key);
  if (!formatResult.valid) {
    showResult(formatResult.reason, false);
    btn.disabled = false;
    btn.textContent = '激活';
    return;
  }

  const deviceId = await getDeviceId();
  const result = await activateLicenseOnline(formatResult.key, deviceId);

  if (!result.success && !result.valid) {
    showResult(result.error || result.message || '激活码无效', false);
    btn.disabled = false;
    btn.textContent = '激活';
    return;
  }

  const licenseData = {
    licenseKey: formatResult.key,
    deviceId: deviceId,
    activatedAt: new Date().toISOString(),
    version: 1
  };

  // 保存到书签
  const saveResult = await saveToBookmark(licenseData);

  if (saveResult.success) {
    showResult('激活成功！', true);
    showProStatus(licenseData);
  } else {
    showResult('书签保存失败: ' + saveResult.error, false);
    btn.disabled = false;
    btn.textContent = '激活';
  }
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
  const licenseInput = document.getElementById('licenseInput');
  const activateBtn = document.getElementById('activateBtn');

  if (status) status.classList.remove('active');
  if (inputArea) inputArea.style.display = 'block';
  if (licenseInput) licenseInput.value = '';
  if (activateBtn) {
    activateBtn.disabled = false;
    activateBtn.textContent = '激活';
  }
}

/**
 * 检查激活状态
 */
async function checkActivation() {
  const data = await readFromBookmark();
  if (data && data.licenseKey) {
    showProStatus(data);
    return true;
  }
  return false;
}

// 页面加载
document.addEventListener('DOMContentLoaded', async () => {
  await checkActivation();

  const activateBtn = document.getElementById('activateBtn');
  if (activateBtn) activateBtn.onclick = activate;

  const licenseInput = document.getElementById('licenseInput');
  if (licenseInput) {
    licenseInput.onkeydown = (e) => {
      if (e.key === 'Enter') activate();
    };
    licenseInput.oninput = (e) => {
      e.target.value = e.target.value.toUpperCase();
    };
  }

  const changeFileBtn = document.getElementById('changeFileBtn');
  if (changeFileBtn) changeFileBtn.onclick = reactivate;
});
