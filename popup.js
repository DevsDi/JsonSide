/**
 * JSON Side - Popup Script
 */

// ===================== 付费限制配置 =====================
const FREE_DIFF_LIMIT = 3;              // 每日免费次数
const FREE_DIFF_SIZE = 10 * 1024;       // 免费版最大 10KB
const PRO_DIFF_SIZE = 2 * 1024 * 1024;  // Pro 版最大 2MB
const FREE_FORMAT_TS_LIMIT = 3;         // 每日免费格式化时间次数

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

// ===================== 许可证验证（从书签读取） =====================

const BOOKMARK_TITLE = '.jsonside-license';
const ENCRYPT_KEY = 'JsonSide2024SecretKey';

/**
 * 解密函数
 */
function decryptLicense(encoded, key) {
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
 * 从书签读取许可证数据
 */
async function getLicenseData() {
  try {
    const bookmarks = await chrome.bookmarks.search({ title: BOOKMARK_TITLE });
    if (bookmarks.length === 0) return null;

    const url = bookmarks[0].url;
    if (!url || !url.startsWith('data:text/plain;base64,')) return null;

    const encoded = url.substring('data:text/plain;base64,'.length);
    const decrypted = decryptLicense(encoded, ENCRYPT_KEY);
    if (!decrypted) return null;

    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}

/**
 * 检查是否为 Pro 用户（默认所有用户都是 Pro）
 */
async function isProUser() {
  return true;
}

/**
 * 获取今日 Diff 使用次数
 */
async function getTodayDiffUsage() {
  try {
    const result = await chrome.storage.local.get(['diffUsageDate', 'diffUsageCount']);
    const today = new Date().toDateString();

    if (result.diffUsageDate !== today) {
      await chrome.storage.local.set({ diffUsageDate: today, diffUsageCount: 0 });
      return 0;
    }
    return result.diffUsageCount || 0;
  } catch (e) {
    return 0;
  }
}

/**
 * 检查是否可以使用 Diff
 * @param {number} inputSize - 输入内容大小
 * @returns {Object} { allowed, reason, message, usage, isPro }
 */
async function canUseDiff(inputSize) {
  const isPro = await isProUser();

  if (isPro) {
    // Pro 用户检查大小限制
    if (inputSize > PRO_DIFF_SIZE) {
      return {
        allowed: false,
        reason: 'size_limit',
        message: `Content too large (${(inputSize/1024/1024).toFixed(1)}MB), max 2MB`,
        isPro: true
      };
    }
    return { allowed: true, isPro: true };
  }

  // 免费用户检查大小限制
  if (inputSize > FREE_DIFF_SIZE) {
    return {
      allowed: false,
      reason: 'size_limit',
      message: `Free version max 10KB, current ${(inputSize/1024).toFixed(1)}KB`
    };
  }

  // 免费用户检查次数限制
  const usage = await getTodayDiffUsage();
  if (usage >= FREE_DIFF_LIMIT) {
    return {
      allowed: false,
      reason: 'count_limit',
      message: `Used ${usage} times today`
    };
  }

  return { allowed: true, usage, isPro: false };
}

/**
 * 记录 Diff 使用次数
 */
async function recordDiffUsage() {
  if (await isProUser()) return;
  const usage = await getTodayDiffUsage();
  await chrome.storage.local.set({ diffUsageCount: usage + 1 });
}

/**
 * 获取今日 Format Time 使用次数
 */
async function getTodayFormatTsUsage() {
  try {
    const result = await chrome.storage.local.get(['formatTsDate', 'formatTsCount']);
    const today = new Date().toDateString();

    if (result.formatTsDate !== today) {
      await chrome.storage.local.set({ formatTsDate: today, formatTsCount: 0 });
      return 0;
    }
    return result.formatTsCount || 0;
  } catch (e) {
    return 0;
  }
}

/**
 * 检查是否可以使用 Format Time
 * @returns {Object} { allowed, reason, message, usage, isPro }
 */
async function canUseFormatTs() {
  const isPro = await isProUser();

  if (isPro) {
    return { allowed: true, isPro: true };
  }

  const usage = await getTodayFormatTsUsage();
  if (usage >= FREE_FORMAT_TS_LIMIT) {
    return {
      allowed: false,
      reason: 'count_limit',
      message: `Used ${usage} times today`,
      usage
    };
  }

  return { allowed: true, usage, isPro: false };
}

/**
 * 记录 Format Time 使用次数
 */
async function recordFormatTsUsage() {
  if (await isProUser()) return;
  const usage = await getTodayFormatTsUsage();
  await chrome.storage.local.set({ formatTsCount: usage + 1 });
}

// Z5: 安全获取 DOM 元素，检查 null
function safeGetElement(id) {
  const el = document.getElementById(id);
  // A4: 不使用 console.warn，避免日志
  return el;
}

const input = safeGetElement('input');
const output = safeGetElement('output');
const tzSelect = safeGetElement('tzSelect');
const formatBtn = safeGetElement('formatBtn');
const formatTsBtn = safeGetElement('formatTsBtn');
const expandBtn = safeGetElement('expandBtn');
const collapseBtn = safeGetElement('collapseBtn');
const copyBtn = safeGetElement('copyBtn');
const clearBtn = safeGetElement('clearBtn');
const toast = safeGetElement('toast');

// Diff 模式元素
const modeFormatBtn = safeGetElement('modeFormatBtn');
const modeDiffBtn = safeGetElement('modeDiffBtn');
const formatMode = safeGetElement('formatMode');
const diffMode = safeGetElement('diffMode');
const diffInputA = safeGetElement('diffInputA');
const diffInputB = safeGetElement('diffInputB');
const swapBtn = safeGetElement('swapBtn');
const clearDiffBtn = safeGetElement('clearDiffBtn');

// Z5: 关键元素检查，如果缺失则停止执行
if (!input || !output) {
  throw new Error('Required DOM elements not found');
}

let formattedJson = '';
let idCounter = 0;

// ===================== 历史记录 =====================

/**
 * 获取最大历史记录条数（Pro 用户 100，免费用户 10）
 */
async function getMaxHistory() {
  return (await isProUser()) ? 100 : 10;
}

/**
 * 保存到历史记录
 * @param {string} jsonText - JSON 文本
 * @param {string} source - 来源: 'manual' | 'right-click'
 */
async function saveToHistory(jsonText, source = 'manual') {
  if (!jsonText || jsonText.trim().length < 2) return;

  // V4: 限制单条历史记录大小 (100KB)
  const MAX_HISTORY_ITEM_SIZE = 100 * 1024;
  if (jsonText.length > MAX_HISTORY_ITEM_SIZE) {
    return;
  }

  // V3: 验证 source 值，防止注入
  const validSources = ['manual', 'right-click'];
  const safeSource = validSources.includes(source) ? source : 'manual';

  try {
    const result = await chrome.storage.local.get('history');
    const history = result.history || [];

    // 去重：检查是否已存在相同内容
    const exists = history.findIndex(h => h.json === jsonText);
    if (exists >= 0) {
      // 已存在，移到最前面
      history.splice(exists, 1);
    }

    // 添加新记录
    history.unshift({
      json: jsonText,
      source: safeSource,
      time: new Date().toISOString(),
      preview: jsonText.substring(0, 60).replace(/\n/g, ' ')
    });

    // 限制条数（Pro 用户 1000，免费用户 10）
    const MAX_HISTORY = await getMaxHistory();
    const limited = history.slice(0, MAX_HISTORY);
    await chrome.storage.local.set({ history: limited });
  } catch (e) {
    // 静默处理错误
  }
}

/**
 * 获取历史记录
 */
async function getHistory() {
  try {
    const result = await chrome.storage.local.get('history');
    return result.history || [];
  } catch (e) {
    return [];
  }
}

/**
 * 清除历史记录
 */
async function clearHistory() {
  await chrome.storage.local.remove('history');
}

/**
 * 删除单条历史记录
 */
async function deleteHistoryItem(index) {
  try {
    const result = await chrome.storage.local.get('history');
    const history = result.history || [];
    history.splice(index, 1);
    await chrome.storage.local.set({ history });
  } catch (e) {}
}

// 初始化：加载时区设置和选中的 JSON
async function init() {
  try {
    const saved = await chrome.storage.local.get(['tzOffset', 'jsonText']);
    if (saved.tzOffset !== undefined) {
      // Y1: 验证时区值范围（-12 到 +12）
      const tzValue = Number(saved.tzOffset);
      if (!isNaN(tzValue) && tzValue >= -12 && tzValue <= 12) {
        tzSelect.value = tzValue;
      }
    }
    // 如果有选中的 JSON，自动填入并格式化
    if (saved.jsonText) {
      // Y2: 验证 jsonText 大小
      if (saved.jsonText.length > MAX_INPUT_SIZE) {
        output.innerHTML = `<div class="error">Input too large, please limit to 1MB</div>`;
        chrome.storage.local.remove('jsonText');
        return;
      }
      input.value = saved.jsonText;
      format();
      // 清除存储，避免下次打开时重复加载
      chrome.storage.local.remove('jsonText');
    }
  } catch (e) {}
}

// 格式化时间戳
function formatTs(ts, tz) {
  const ms = ts > 1000000000000 ? ts : ts * 1000;
  const date = new Date(ms + tz * 3600000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const sec = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${sec}`;
}

// HTML 转义（增强版，防止 XSS）
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

// 输入大小限制（1MB）
const MAX_INPUT_SIZE = 1024 * 1024;

// 嵌套深度限制
const MAX_DEPTH = 50;

// ID 计数器最大值（防止溢出）
const MAX_ID_COUNTER = 10000000;

// 时间戳合理范围（2000-01-01 到 2100-01-01）
const TS_MIN_SEC = 946684800;    // 2000-01-01 00:00:00 UTC (秒)
const TS_MAX_SEC = 4102444800;   // 2100-01-01 00:00:00 UTC (秒)

// 渲染 JSON（带深度限制）
function render(data, depth = 0) {
  // 深度限制检查
  if (depth > MAX_DEPTH) {
    return '<span class="error" style="color: #f38ba8;">Nested too deep, truncated</span>';
  }

  if (data === null) return '<span class="v-null">null</span>';
  if (typeof data === 'string') return `<span class="v-string">"${esc(data)}"</span>`;
  if (typeof data === 'number') {
    // V7: 更严格的时间戳判断（2000-2100年范围）
    let isTs = false;
    if (data > TS_MIN_SEC && data < TS_MAX_SEC) {
      // 秒级时间戳
      isTs = true;
    } else if (data > TS_MIN_SEC * 1000 && data < TS_MAX_SEC * 1000) {
      // 毫秒级时间戳
      isTs = true;
    }
    if (isTs) {
      return `<span class="v-number v-ts" data-ts="${data}">${data}</span>`;
    }
    return `<span class="v-number">${data}</span>`;
  }
  if (typeof data === 'boolean') return `<span class="v-bool">${data}</span>`;

  if (Array.isArray(data)) {
    if (data.length === 0) return '<span class="v-bracket">[]</span>';
    // V6: idCounter 溢出保护
    if (idCounter > MAX_ID_COUNTER) {
      idCounter = 0;
    }
    const id = 'n' + (idCounter++);
    const items = data.map((v, i) => {
      const val = render(v, depth + 1);
      const comma = i < data.length - 1 ? '<span class="v-comma">,</span>' : '';
      return `<div class="line">${val}${comma}</div>`;
    }).join('');
    return `<span class="toggle" data-id="${id}">▼</span><span class="v-bracket">[</span><span class="v-count">${data.length}</span><div class="block" id="${id}">${items}</div><span class="v-bracket">]</span>`;
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return '<span class="v-bracket">{}</span>';
    // V6: idCounter 溢出保护
    if (idCounter > MAX_ID_COUNTER) {
      idCounter = 0;
    }
    const id = 'n' + (idCounter++);
    const items = keys.map((k, i) => {
      const val = render(data[k], depth + 1);
      const comma = i < keys.length - 1 ? '<span class="v-comma">,</span>' : '';
      return `<div class="line"><span class="v-key">"${esc(k)}"</span>: ${val}${comma}</div>`;
    }).join('');
    return `<span class="toggle" data-id="${id}">▼</span><span class="v-bracket">{</span><span class="v-count">${keys.length}</span><div class="block" id="${id}">${items}</div><span class="v-bracket">}</span>`;
  }

  return String(data);
}

// 绑定事件
function bindEvents() {
  // 折叠
  output.querySelectorAll('.toggle').forEach(el => {
    el.onclick = () => {
      // W7: 验证 dataset.id 格式，防止伪造
      const id = el.dataset.id;
      if (id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) {
        const block = document.getElementById(id);
        if (block) {
          const hide = block.classList.toggle('hide');
          el.textContent = hide ? '▶' : '▼';
        }
      }
    };
  });

  // 点击时间戳
  output.querySelectorAll('.v-ts').forEach(el => {
    el.onclick = () => {
      const ts = el.dataset.ts;
      // W7: 验证时间戳格式
      if (ts && /^\d+$/.test(ts)) {
        const tz = Number(tzSelect.value);
        const isFmt = el.classList.toggle('formatted');
        el.textContent = isFmt ? formatTs(Number(ts), tz) : ts;
      }
    };
  });
}

// 格式化（带输入大小限制）
function format() {
  const text = input.value.trim();
  if (!text) return;

  // 输入大小检查
  if (text.length > MAX_INPUT_SIZE) {
    output.innerHTML = `<div class="error">Input too large (${(text.length / 1024 / 1024).toFixed(2)}MB), please limit to 1MB</div>`;
    formattedJson = '';
    return;
  }

  idCounter = 0;

  try {
    const obj = JSON.parse(text);
    formattedJson = JSON.stringify(obj, null, 2);
    output.innerHTML = render(obj);
    bindEvents();
    // 保存到历史记录
    saveToHistory(text, 'manual');
  } catch (e) {
    output.innerHTML = `<div class="error">Parse failed: ${esc(e.message)}</div>`;
    formattedJson = '';
  }
}

// 格式化所有时间戳
async function formatAllTs() {
  const tz = Number(tzSelect.value);
  const all = output.querySelectorAll('.v-ts');
  if (!all.length) return;

  // 检查是否已格式化（取消格式化不需要检查限制）
  const allFmt = Array.from(all).every(el => el.classList.contains('formatted'));

  if (!allFmt) {
    // 需要格式化，检查限制
    const check = await canUseFormatTs();
    if (!check.allowed) {
      showFormatTsUpgradeDialog(check);
      return;
    }
    await recordFormatTsUsage();
  }

  all.forEach(el => {
    const ts = el.dataset.ts;
    if (allFmt) {
      el.classList.remove('formatted');
      el.textContent = ts;
    } else {
      el.classList.add('formatted');
      el.textContent = formatTs(Number(ts), tz);
    }
  });
}

/**
 * 显示 Format Time 升级弹窗
 */
function showFormatTsUpgradeDialog(check) {
  showProDialog('Format Time: Daily limit reached (3 times). Upgrade to Pro for unlimited use.');
}

// 全部展开
function expandAll() {
  output.querySelectorAll('.block.hide').forEach(b => b.classList.remove('hide'));
  output.querySelectorAll('.toggle').forEach(t => t.textContent = '▼');
}

// 全部收起
function collapseAll() {
  output.querySelectorAll('.block').forEach(b => b.classList.add('hide'));
  output.querySelectorAll('.toggle').forEach(t => t.textContent = '▶');
}

// 复制（带错误处理）
async function copy() {
  if (!formattedJson) return;
  try {
    await navigator.clipboard.writeText(formattedJson);
    showToast();
  } catch (e) {
    // Z4: 剪贴板写入失败处理
    // 静默处理错误，或可显示提示
  }
}

// 清空
function clear() {
  input.value = '';
  output.innerHTML = '';
  formattedJson = '';
}

// 显示提示
function showToast() {
  toast.style.display = 'block';
  setTimeout(() => toast.style.display = 'none', 2000);
}

// 事件绑定
formatBtn.onclick = format;
formatTsBtn.onclick = formatAllTs;
expandBtn.onclick = expandAll;
collapseBtn.onclick = collapseAll;
copyBtn.onclick = copy;
clearBtn.onclick = clear;

tzSelect.onchange = () => {
  // Y1: 验证时区值范围后再存储
  const tzValue = Number(tzSelect.value);
  if (!isNaN(tzValue) && tzValue >= -12 && tzValue <= 12) {
    chrome.storage.local.set({ tzOffset: tzValue });
  }
};

// 回车格式化
input.onkeydown = (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    format();
  }
};

// 初始化
init();

// ===================== 模式切换 =====================

const modeConvertBtn = document.getElementById('modeConvertBtn');
const modePathBtn = document.getElementById('modePathBtn');
const modeCompactBtn = document.getElementById('modeCompactBtn');
const convertMode = document.getElementById('convertMode');
const pathMode = document.getElementById('pathMode');
const compactMode = document.getElementById('compactMode');
const convertInput = document.getElementById('convertInput');
const convertResult = document.getElementById('convertResult');
const clearConvertBtn = document.getElementById('clearConvertBtn');
const copyConvertBtn = document.getElementById('copyConvertBtn');

let currentConvertType = 'typescript';
let currentMode = 'format';

function hideFormatButtons(hide) {
  // Format 模式按钮组
  document.getElementById('formatToolbarBtns').style.display = hide ? 'none' : 'flex';
  // 非 Format 模式显示对应模式的操作按钮，Format 模式隐藏所有模式操作按钮
  document.getElementById('diffToolbarBtns').style.display = (hide && currentMode === 'diff') ? 'flex' : 'none';
  document.getElementById('convertToolbarBtns').style.display = (hide && currentMode === 'convert') ? 'flex' : 'none';
  document.getElementById('pathToolbarBtns').style.display = (hide && currentMode === 'path') ? 'flex' : 'none';
  document.getElementById('compactToolbarBtns').style.display = (hide && currentMode === 'compact') ? 'flex' : 'none';
}

function switchMode(mode) {
  currentMode = mode;
  // 重置所有按钮
  [modeFormatBtn, modeDiffBtn, modeConvertBtn, modePathBtn, modeCompactBtn].forEach(btn => btn.classList.remove('active'));
  // 隐藏所有模式
  [formatMode, diffMode, convertMode, pathMode, compactMode].forEach(m => m.style.display = 'none');

  switch (mode) {
    case 'format':
      modeFormatBtn.classList.add('active');
      formatMode.style.display = 'grid';
      hideFormatButtons(false);
      break;
    case 'diff':
      modeDiffBtn.classList.add('active');
      diffMode.style.display = 'grid';
      hideFormatButtons(true);
      break;
    case 'convert':
      modeConvertBtn.classList.add('active');
      convertMode.style.display = 'grid';
      hideFormatButtons(true);
      break;
    case 'path':
      modePathBtn.classList.add('active');
      pathMode.style.display = 'grid';
      hideFormatButtons(true);
      break;
    case 'compact':
      modeCompactBtn.classList.add('active');
      compactMode.style.display = 'grid';
      hideFormatButtons(true);
      break;
  }
}

modeFormatBtn.onclick = () => switchMode('format');
modeDiffBtn.onclick = () => switchMode('diff');
modeConvertBtn.onclick = () => switchMode('convert');
modePathBtn.onclick = () => switchMode('path');
modeCompactBtn.onclick = () => switchMode('compact');

// ===================== 历史记录面板 =====================

const historyBtn = document.getElementById('historyBtn');
const historyPanel = document.getElementById('historyPanel');
const historyOverlay = document.getElementById('historyOverlay');
const historyList = document.getElementById('historyList');
const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');

/**
 * 格式化时间显示（相对时间）
 */
function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' hours ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' days ago';

  return date.toLocaleDateString('en-US');
}

/**
 * 格式化完整时间（带时区转换）
 * @param {string} isoString - ISO 时间字符串（UTC）
 * @param {number} tzOffset - 时区偏移，如 8 表示 UTC+8
 */
function formatFullTime(isoString, tzOffset = 8) {
  const date = new Date(isoString);
  // 转換為指定時區的時間
  const offsetMs = tzOffset * 3600000;
  const localDate = new Date(date.getTime() + offsetMs);

  const y = localDate.getUTCFullYear();
  const m = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(localDate.getUTCDate()).padStart(2, '0');
  const h = String(localDate.getUTCHours()).padStart(2, '0');
  const min = String(localDate.getUTCMinutes()).padStart(2, '0');
  const sec = String(localDate.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${sec}`;
}

// 历史记录分页配置
const HISTORY_PAGE_SIZE = 10; // 每页条数
let historyCurrentPage = 0;
let historyAllData = [];

/**
 * 渲染历史记录列表（分页）
 */
async function renderHistoryList() {
  historyAllData = await getHistory();
  historyCurrentPage = 0;

  const maxHistory = await getMaxHistory();

  // 更新标题显示条数
  const countEl = document.getElementById('historyCount');
  if (countEl) {
    countEl.textContent = `${historyAllData.length}/${maxHistory}`;
  }

  if (historyAllData.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No history</div>';
    // 隐藏分页
    const pagination = document.getElementById('historyPagination');
    if (pagination) pagination.style.display = 'none';
    return;
  }

  // 显示分页
  const pagination = document.getElementById('historyPagination');
  if (pagination) pagination.style.display = 'flex';

  // 渲染当前页
  renderHistoryPage();
}

/**
 * 渲染当前页历史记录
 */
function renderHistoryPage() {
  const start = historyCurrentPage * HISTORY_PAGE_SIZE;
  const end = start + HISTORY_PAGE_SIZE;
  const pageData = historyAllData.slice(start, end);

  const tzOffset = Number(tzSelect.value);
  const validSources = ['manual', 'right-click'];

  historyList.innerHTML = pageData.map((item, i) => {
    const index = start + i;
    const safeSource = validSources.includes(item.source) ? item.source : 'manual';
    return `
    <div class="history-item" data-index="${index}">
      <span class="history-index">${index + 1}</span>
      <span class="history-icon ${safeSource}">${safeSource === 'right-click' ? '🔗' : '📋'}</span>
      <div class="history-content">
        <div class="history-preview">${escDiff(item.preview)}...</div>
        <div class="history-meta">
          <span class="history-time">${formatFullTime(item.time, tzOffset)}</span>
          <span class="history-source">${safeSource === 'right-click' ? 'Right-click' : 'Manual'}</span>
        </div>
      </div>
      <button class="history-delete" data-index="${index}">Delete</button>
    </div>`;
  }).join('');

  // 绑定点击事件
  historyList.querySelectorAll('.history-item').forEach(el => {
    el.onclick = (e) => {
      if (e.target.classList.contains('history-delete')) return;
      const index = parseInt(el.dataset.index, 10);
      loadHistoryItem(index);
    };
  });

  // 绑定删除事件
  historyList.querySelectorAll('.history-delete').forEach(el => {
    el.onclick = async (e) => {
      e.stopPropagation();
      const index = parseInt(el.dataset.index, 10);
      await deleteHistoryItem(index);
      renderHistoryList();
    };
  });

  // 更新分页状态
  updatePagination();
}

/**
 * 更新分页状态
 */
function updatePagination() {
  const totalPages = Math.ceil(historyAllData.length / HISTORY_PAGE_SIZE);
  const pageEl = document.getElementById('historyPageInfo');
  const prevBtn = document.getElementById('historyPrevBtn');
  const nextBtn = document.getElementById('historyNextBtn');

  if (pageEl) {
    pageEl.textContent = `${historyCurrentPage + 1}/${totalPages}`;
  }

  if (prevBtn) {
    prevBtn.disabled = historyCurrentPage === 0;
  }

  if (nextBtn) {
    nextBtn.disabled = historyCurrentPage >= totalPages - 1;
  }
}

/**
 * 上一页
 */
function historyPrevPage() {
  if (historyCurrentPage > 0) {
    historyCurrentPage--;
    renderHistoryPage();
    // 滚动到顶部
    historyList.scrollTop = 0;
  }
}

/**
 * 下一页
 */
function historyNextPage() {
  const totalPages = Math.ceil(historyAllData.length / HISTORY_PAGE_SIZE);
  if (historyCurrentPage < totalPages - 1) {
    historyCurrentPage++;
    renderHistoryPage();
    // 滚动到顶部
    historyList.scrollTop = 0;
  }
}

/**
 * 加载历史记录项
 */
async function loadHistoryItem(index) {
  const history = await getHistory();
  if (history[index]) {
    input.value = history[index].json;
    format();
    // 关闭侧边栏
    closeHistoryDrawer();
  }
}

/**
 * 打开历史侧边栏
 */
async function openHistoryDrawer() {
  historyPanel.classList.add('show');
  historyOverlay.classList.add('show');
  renderHistoryList();

  // 检查是否为 Pro 用户，显示/隐藏限制提示
  const tip = document.getElementById('historyLimitTip');
  if (tip) {
    tip.style.display = (await isProUser()) ? 'none' : 'inline';
  }
}

/**
 * 关闭历史侧边栏
 */
function closeHistoryDrawer() {
  historyPanel.classList.remove('show');
  historyOverlay.classList.remove('show');
}

historyBtn.onclick = openHistoryDrawer;
closeHistoryBtn.onclick = closeHistoryDrawer;
historyOverlay.onclick = closeHistoryDrawer;

// 清空全部历史
clearAllHistoryBtn.onclick = async () => {
  if (confirm('Clear all history?')) {
    await clearHistory();
    renderHistoryList();
  }
};

// 分页按钮事件
document.getElementById('historyPrevBtn').onclick = historyPrevPage;
document.getElementById('historyNextBtn').onclick = historyNextPage;

// ===================== 激活状态管理 =====================

/**
 * 更新激活按钮状态
 */
async function updateLicenseButton() {
  const btn = document.getElementById('licenseBtn');
  if (!btn) return;

  const isPro = await isProUser();

  if (isPro) {
    btn.textContent = '☕';
    btn.title = 'Support us';
    btn.classList.add('activated');
    // 点击 ☕ 按钮显示打赏弹窗
    btn.onclick = () => showDonateDialog();
  } else {
    btn.textContent = '☕';
    btn.title = 'Activate Pro';
    btn.classList.remove('activated');
    btn.onclick = () => showProDialog();
  }
}

/**
 * 显示打赏弹窗（已激活用户点击 PRO 按钮）
 */
function showDonateDialog() {
  const overlay = document.getElementById('proOverlay');
  if (!overlay) return;

  // 隐藏所有其他区域
  const unactivatedEl = document.getElementById('proUnactivated');
  const loadingEl = document.getElementById('proLoading');
  const successEl = document.getElementById('proSuccess');
  const closeBtnX = document.getElementById('closeProBtn');

  if (unactivatedEl) unactivatedEl.style.display = 'none';
  if (loadingEl) loadingEl.style.display = 'none';
  if (successEl) successEl.style.display = 'none';
  if (closeBtnX) closeBtnX.style.display = 'none';

  // 显示 activated 容器，但隐藏激活相关内容，只显示打赏
  const activatedEl = document.getElementById('proActivated');
  if (activatedEl) {
    activatedEl.style.display = 'block';

    // 隐藏激活码相关内容
    const header = document.getElementById('activatedHeader');
    const title = document.getElementById('activatedTitle');
    const keyBox = document.getElementById('keyDisplayBox');
    const inputWrap = document.getElementById('activatedInputWrap');
    const confirmBtn = document.getElementById('confirmActivateBtn');
    const resultConfirm = document.getElementById('licenseResultConfirm');

    if (header) header.style.display = 'none';
    if (title) title.style.display = 'none';
    if (keyBox) keyBox.style.display = 'none';
    if (inputWrap) inputWrap.style.display = 'none';
    if (confirmBtn) confirmBtn.style.display = 'none';
    if (resultConfirm) resultConfirm.style.display = 'none';

    // 显示打赏区域
    const donateSection = document.getElementById('donateSection');
    if (donateSection) donateSection.style.display = 'block';
  }

  // 显示 Close 按钮
  document.getElementById('closeProBtn2').style.display = 'block';

  // 绑定打赏按钮
  document.querySelectorAll('.donate-btn').forEach(donateBtn => {
    donateBtn.onclick = () => {
      const amount = donateBtn.dataset.amount;
      let url = 'https://paypal.me/DevinDai';
      if (amount === '1') url = 'https://paypal.me/DevinDai/1';
      else if (amount === '2') url = 'https://paypal.me/DevinDai/2';
      else if (amount === '5') url = 'https://paypal.me/DevinDai/5';
      chrome.tabs.create({ url });
    };
  });

  overlay.style.display = 'flex';

  // 绑定关闭按钮
  const closeBtn2 = document.getElementById('closeProBtn2');
  if (closeBtn2) {
    closeBtn2.onclick = () => { overlay.style.display = 'none'; };
  }
}

// ===================== Pro 弹窗功能 =====================

const LICENSE_ENCRYPT_KEY = 'JsonSide2024SecretKey';
const LICENSE_BOOKMARK_TITLE = '.jsonside-license';

/**
 * 加密
 */
function licenseEncrypt(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(unescape(encodeURIComponent(result)));
}

/**
 * 保存到书签（含降级重试逻辑）
 */
async function saveLicenseToBookmark(data) {
  try {
    const jsonStr = JSON.stringify(data);
    const encrypted = licenseEncrypt(jsonStr, LICENSE_ENCRYPT_KEY);
    const url = `data:text/plain;base64,${encrypted}`;

    const existing = await chrome.bookmarks.search({ title: LICENSE_BOOKMARK_TITLE });
    if (existing.length > 0) {
      await chrome.bookmarks.update(existing[0].id, { url });
      return { success: true };
    }

    // 获取所有可用的书签文件夹
    const tree = await chrome.bookmarks.getTree();
    const rootNode = tree[0];
    if (!rootNode || !rootNode.children || rootNode.children.length === 0) {
      return { success: false, error: 'No bookmark folder available' };
    }

    const folders = rootNode.children.filter(child => child.children !== undefined);
    if (folders.length === 0) {
      return { success: false, error: 'No bookmark folder available' };
    }

    // 逐个尝试创建书签，直到成功
    let lastError = null;
    for (const folder of folders) {
      try {
        await chrome.bookmarks.create({
          parentId: folder.id,
          title: LICENSE_BOOKMARK_TITLE,
          url: url
        });
        return { success: true };
      } catch (e) {
        lastError = e;
        // 当前文件夹失败，尝试下一个
        continue;
      }
    }

    return { success: false, error: lastError ? lastError.message : 'All bookmark folders failed' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 显示 Pro 弹窗
 */
async function showProDialog(reason = null) {
  const overlay = document.getElementById('proOverlay');
  if (!overlay) return;

  overlay.style.display = 'flex';

  // 检查是否已激活
  const data = await getLicenseData();
  const isPro = data && data.licenseKey;

  const unactivatedEl = document.getElementById('proUnactivated');
  const activatedEl = document.getElementById('proActivated');
  const reasonEl = document.getElementById('proReason');
  const loadingEl = document.getElementById('proLoading');
  const successEl = document.getElementById('proSuccess');

  // 重置所有状态
  if (loadingEl) loadingEl.classList.remove('active');
  if (successEl) successEl.classList.remove('active');

  if (isPro) {
    unactivatedEl.style.display = 'none';
    activatedEl.style.display = 'block';
    if (loadingEl) loadingEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
    document.getElementById('displayKey').textContent = data.licenseKey;
    document.getElementById('closeProBtn2').style.display = 'block';

    // 已激活状态隐藏×按钮，确保打赏区可见，只能通过下方Close关闭
    const closeBtnX = document.getElementById('closeProBtn');
    if (closeBtnX) closeBtnX.style.display = 'none';

    // 已激活状态显示激活码
    const keyEl = document.getElementById('displayKey');
    if (keyEl) keyEl.classList.add('revealed');

    // 恢复显示所有激活相关元素（以防从打赏弹窗切换过来）
    const header = document.getElementById('activatedHeader');
    const title = document.getElementById('activatedTitle');
    const keyBox = document.getElementById('keyDisplayBox');
    const inputWrap = document.getElementById('activatedInputWrap');
    const donateSection = document.getElementById('donateSection');

    if (header) header.style.display = 'block';
    if (title) title.style.display = 'block';
    if (keyBox) keyBox.style.display = 'flex';
    if (inputWrap) inputWrap.style.display = 'block';
    if (donateSection) donateSection.style.display = 'block';

    // 已激活状态，隐藏输入框和激活按钮
    const confirmInput = document.getElementById('licenseInputConfirm');
    if (confirmInput) confirmInput.style.display = 'none';

    const confirmBtn = document.getElementById('confirmActivateBtn');
    if (confirmBtn) {
      const btnText = document.getElementById('confirmBtnText');
      if (btnText) btnText.textContent = '✓ Activated!';
      confirmBtn.disabled = true;
      confirmBtn.style.background = '#10b981';
    }

    // 绑定打赏按钮
    document.querySelectorAll('.donate-btn').forEach(donateBtn => {
      donateBtn.onclick = () => {
        const amount = donateBtn.dataset.amount;
        let url = 'https://paypal.me/DevinDai';
        if (amount === '1') url = 'https://paypal.me/DevinDai/1';
        else if (amount === '2') url = 'https://paypal.me/DevinDai/2';
        else if (amount === '5') url = 'https://paypal.me/DevinDai/5';
        chrome.tabs.create({ url });
      };
    });
  } else {
    unactivatedEl.style.display = 'block';
    activatedEl.style.display = 'none';
    if (loadingEl) loadingEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
    document.getElementById('closeProBtn2').style.display = 'none';
    // 未激活状态恢复×按钮
    const closeBtnX = document.getElementById('closeProBtn');
    if (closeBtnX) closeBtnX.style.display = '';
    reasonEl.textContent = reason || '';
    reasonEl.style.display = reason ? 'block' : 'none';
    document.getElementById('licenseResult').style.display = 'none';

    // 重置确认激活按钮和输入框
    const confirmInput = document.getElementById('licenseInputConfirm');
    if (confirmInput) {
      confirmInput.style.display = '';
      confirmInput.value = '';
      confirmInput.disabled = false;
    }

    const confirmBtn = document.getElementById('confirmActivateBtn');
    if (confirmBtn) {
      const btnText = document.getElementById('confirmBtnText');
      if (btnText) btnText.textContent = 'Activate';
      confirmBtn.disabled = false;
      confirmBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    }
  }

  // 绑定事件
  const closeBtn = document.getElementById('closeProBtn');
  if (closeBtn) {
    closeBtn.onclick = () => { overlay.style.display = 'none'; };
  }

  const closeBtn2 = document.getElementById('closeProBtn2');
  if (closeBtn2) {
    closeBtn2.onclick = () => { overlay.style.display = 'none'; };
  }

  const activateBtn = document.getElementById('activateBtn');
  if (activateBtn) {
    activateBtn.onclick = doActivate;
    activateBtn.disabled = false;
    activateBtn.textContent = 'Get License';
  }
}

/**
 * 执行激活（本地随机领取激活码）
 */
async function doActivate() {
  const btn = document.getElementById('activateBtn');
  const unactivatedEl = document.getElementById('proUnactivated');
  const loadingEl = document.getElementById('proLoading');

  btn.disabled = true;

  // 显示加载动画
  unactivatedEl.style.display = 'none';
  if (loadingEl) {
    loadingEl.style.display = 'flex';
    loadingEl.classList.add('active');
  }

  // 模拟生成过程
  await new Promise(r => setTimeout(r, 500));

  try {
    // 从激活码池中随机选择一个
    const randomIndex = Math.floor(Math.random() * LICENSE_POOL.length);
    const licenseKey = LICENSE_POOL[randomIndex];

    const licenseData = {
      licenseKey: licenseKey,
      activatedAt: new Date().toISOString(),
      version: 1
    };

    // 隐藏加载动画，显示激活码
    if (loadingEl) {
      loadingEl.classList.remove('active');
      loadingEl.style.display = 'none';
    }

    // 显示激活码，等待用户确认激活
    document.getElementById('proActivated').style.display = 'block';
    document.getElementById('displayKey').textContent = licenseKey;
    document.getElementById('closeProBtn2').style.display = 'block';

    // 默认隐藏激活码，点击切换显示
    const keyEl = document.getElementById('displayKey');
    const maskEl = document.getElementById('displayKeyMask');
    if (keyEl) keyEl.classList.remove('revealed');

    if (keyEl) {
      keyEl.onclick = () => { keyEl.classList.toggle('revealed'); };
    }
    if (maskEl) {
      maskEl.onclick = () => { if (keyEl) keyEl.classList.add('revealed'); };
    }

    // 绑定复制按钮
    const copyBtn = document.getElementById('copyKeyBtn');
    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(licenseKey);
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
        } catch (e) {
          copyBtn.textContent = 'Failed';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
        }
      };
    }

    // 绑定确认激活按钮（需输入激活码）
    const confirmBtn = document.getElementById('confirmActivateBtn');
    const confirmInput = document.getElementById('licenseInputConfirm');
    if (confirmBtn && confirmInput) {
      confirmInput.value = '';
      confirmInput.style.display = '';
      confirmInput.disabled = false;
      confirmBtn.disabled = false;
      const btnText = document.getElementById('confirmBtnText');
      if (btnText) btnText.textContent = 'Activate';
      confirmBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

      confirmBtn.onclick = async () => {
        const inputKey = confirmInput.value.trim().toUpperCase();
        const resultEl = document.getElementById('licenseResultConfirm');
        if (!inputKey) {
          if (resultEl) {
            resultEl.textContent = 'Please enter the license key';
            resultEl.style.display = 'block';
            resultEl.style.background = 'rgba(244,67,54,0.2)';
            resultEl.style.color = '#ef4444';
            resultEl.style.border = '1px solid #ef4444';
            setTimeout(() => { resultEl.style.display = 'none'; }, 3000);
          }
          return;
        }
        if (inputKey !== licenseKey) {
          if (resultEl) {
            resultEl.textContent = 'License key does not match';
            resultEl.style.display = 'block';
            resultEl.style.background = 'rgba(244,67,54,0.2)';
            resultEl.style.color = '#ef4444';
            resultEl.style.border = '1px solid #ef4444';
            setTimeout(() => { resultEl.style.display = 'none'; }, 3000);
          }
          return;
        }
        const saveResult = await saveLicenseToBookmark(licenseData);
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
          confirmBtn.style.background = '#10b981';

          // 隐藏输入框
          confirmInput.style.display = 'none';

          // 隐藏×按钮，只保留下方Close按钮
          const closeBtnX = document.getElementById('closeProBtn');
          if (closeBtnX) closeBtnX.style.display = 'none';
          document.getElementById('closeProBtn2').style.display = 'block';

          await updateLicenseButton();
        } else {
          if (resultEl) {
            resultEl.textContent = 'Save failed: ' + saveResult.error;
            resultEl.style.display = 'block';
            resultEl.style.background = 'rgba(244,67,54,0.2)';
            resultEl.style.color = '#ef4444';
            resultEl.style.border = '1px solid #ef4444';
            setTimeout(() => { resultEl.style.display = 'none'; }, 3000);
          }
        }
      };

      // 回车激活
      confirmInput.onkeydown = (e) => { if (e.key === 'Enter') confirmBtn.onclick(); };
      confirmInput.oninput = (e) => { e.target.value = e.target.value.toUpperCase(); };
    }

    // 绑定打赏按钮
    document.querySelectorAll('.donate-btn').forEach(donateBtn => {
      donateBtn.onclick = () => {
        const amount = donateBtn.dataset.amount;
        let url = 'https://paypal.me/DevinDai';
        if (amount === '1') url = 'https://paypal.me/DevinDai/1';
        else if (amount === '2') url = 'https://paypal.me/DevinDai/2';
        else if (amount === '5') url = 'https://paypal.me/DevinDai/5';
        chrome.tabs.create({ url });
      };
    });

  } catch (e) {
    showLicenseResult('Error: ' + e.message, false);
    btn.disabled = false;
    btn.textContent = 'Get License';
  }
}

/**
 * 显示激活结果
 */
function showLicenseResult(message, success) {
  const el = document.getElementById('licenseResult');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  el.style.background = success ? 'rgba(76,175,50,0.2)' : 'rgba(244,67,54,0.2)';
  el.style.color = success ? '#10b981' : '#ef4444';
  el.style.border = success ? '1px solid #10b981' : '1px solid #ef4444';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

/**
 * 显示升级弹窗（改为调用 Pro 弹窗）
 */
function showUpgradeDialog(check) {
  let reason = check.message || 'Upgrade to unlock full features';
  if (check.reason === 'size_limit') {
    reason = `Content too large, free version max 10KB`;
  } else if (check.reason === 'count_limit') {
    reason = `Daily limit reached`;
  }
  showProDialog(reason);
}

// 初始化激活状态（页面加载时）
document.addEventListener('DOMContentLoaded', () => {
  updateLicenseButton();
});

// ===================== JSON Diff 功能 =====================

let diffIdCounter = 0;
let diffDataA = null;
let diffDataB = null;
let diffRawA = '';  // 原始 JSON 字符串
let diffRawB = '';

/**
 * HTML 转义（增强版，用于 Diff 模式）
 */
function escDiff(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

/**
 * 深度比较收集差异路径（带深度限制）
 */
function collectDiffs(a, b, path = '', depth = 0) {
  const result = { add: new Set(), del: new Set(), mod: new Set() };

  // W1: 深度限制
  if (depth > MAX_DEPTH) return result;

  // 都为空
  if (a === null && b === null) return result;
  if (a === undefined && b === undefined) return result;

  // 一方为空
  if (a === null || a === undefined) {
    result.add.add(path);
    return result;
  }
  if (b === null || b === undefined) {
    result.del.add(path);
    return result;
  }

  const typeA = Array.isArray(a) ? 'array' : typeof a;
  const typeB = Array.isArray(b) ? 'array' : typeof b;

  // 类型不同
  if (typeA !== typeB) {
    result.mod.add(path);
    return result;
  }

  // 数组（必须在基本类型检查之前）
  if (typeA === 'array') {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      const p = path ? `${path}.${i}` : String(i);
      const sub = collectDiffs(a[i], b[i], p, depth + 1);
      result.add = new Set([...result.add, ...sub.add]);
      result.del = new Set([...result.del, ...sub.del]);
      result.mod = new Set([...result.mod, ...sub.mod]);
    }
    return result;
  }

  // 基本类型
  if (typeA !== 'object') {
    if (a !== b) {
      result.mod.add(path);
    }
    return result;
  }

  // 对象
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of allKeys) {
    const p = path ? `${path}.${k}` : k;
    if (!(k in a)) {
      result.add.add(p);
    } else if (!(k in b)) {
      result.del.add(p);
    } else {
      // 递归比较并合并结果
      const sub = collectDiffs(a[k], b[k], p, depth + 1);
      result.add = new Set([...result.add, ...sub.add]);
      result.del = new Set([...result.del, ...sub.del]);
      result.mod = new Set([...result.mod, ...sub.mod]);
    }
  }

  return result;
}

/**
 * 渲染 JSON（带差异高亮和深度限制）
 */
function renderJson(data, diffs, side, path = '', indent = 0, depth = 0) {
  // 深度限制检查
  if (depth > MAX_DEPTH) {
    return `<span class="error" style="color: #f38ba8;">Nested too deep, truncated</span>`;
  }

  const pad = '  '.repeat(indent);
  const isA = side === 'A';

  if (data === null) return `<span class="v-null">null</span>`;
  if (typeof data === 'string') return `<span class="v-string">"${escDiff(data)}"</span>`;
  if (typeof data === 'number') return `<span class="v-number">${data}</span>`;
  if (typeof data === 'boolean') return `<span class="v-bool">${data}</span>`;

  if (Array.isArray(data)) {
    if (data.length === 0) return `<span class="v-bracket">[]</span>`;
    // W4: diffIdCounter 溢出保护
    if (diffIdCounter > MAX_ID_COUNTER) {
      diffIdCounter = 0;
    }
    const id = 'd' + side + (diffIdCounter++);
    const items = data.map((v, i) => {
      const p = path ? `${path}.${i}` : String(i);
      // 检查数组元素是否有差异
      let lineClass = '';
      if (isA) {
        if (diffs.del.has(p)) lineClass = 'diff-del';
        else if (diffs.mod.has(p)) lineClass = 'diff-mod';
      } else {
        if (diffs.add.has(p)) lineClass = 'diff-add';
        else if (diffs.mod.has(p)) lineClass = 'diff-mod';
      }
      return `<div class="line ${lineClass}">${pad}  ${renderJson(v, diffs, side, p, indent + 1, depth + 1)}${i < data.length - 1 ? '<span class="v-comma">,</span>' : ''}</div>`;
    }).join('');
    return `<span class="toggle" data-id="${id}">▼</span><span class="v-bracket">[</span><div class="block" id="${id}">${items}</div><span class="v-bracket">]</span>`;
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return `<span class="v-bracket">{}</span>`;
    // W4: diffIdCounter 溢出保护
    if (diffIdCounter > MAX_ID_COUNTER) {
      diffIdCounter = 0;
    }
    const id = 'd' + side + (diffIdCounter++);
    const items = keys.map((k, i) => {
      const p = path ? `${path}.${k}` : k;

      // 检查 key 本身是否有差异（新增/删除/修改）
      let lineClass = '';
      if (isA) {
        // 左侧：如果这个 key 在右侧不存在，则是删除
        if (diffs.del.has(p)) lineClass = 'diff-del';
        else if (diffs.mod.has(p)) lineClass = 'diff-mod';
      } else {
        // 右侧：如果这个 key 在左侧不存在，则是新增
        if (diffs.add.has(p)) lineClass = 'diff-add';
        else if (diffs.mod.has(p)) lineClass = 'diff-mod';
      }

      return `<div class="line ${lineClass}">${pad}  <span class="v-key">"${escDiff(k)}"</span>: ${renderJson(data[k], diffs, side, p, indent + 1, depth + 1)}${i < keys.length - 1 ? '<span class="v-comma">,</span>' : ''}</div>`;
    }).join('');
    return `<span class="toggle" data-id="${id}">▼</span><span class="v-bracket">{</span><div class="block" id="${id}">${items}</div><span class="v-bracket">}</span>`;
  }

  return String(data);
}

/**
 * 绑定折叠事件（带 ID 验证）
 */
function bindToggle(container) {
  container.querySelectorAll('.toggle').forEach(el => {
    el.onclick = () => {
      // W7: 验证 dataset.id 格式
      const id = el.dataset.id;
      if (id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id)) {
        const block = document.getElementById(id);
        if (block) {
          const hide = block.classList.toggle('hide');
          el.textContent = hide ? '▶' : '▼';
        }
      }
    };
  });
}

/**
 * 执行 Diff 并渲染
 */
function renderDiff() {
  const outputA = document.getElementById('diffOutputA');
  const outputB = document.getElementById('diffOutputB');

  // 重置
  diffIdCounter = 0;

  // 收集差异
  const diffs = collectDiffs(diffDataA, diffDataB);

  // 统计
  const stats = {
    add: diffs.add.size,
    del: diffs.del.size,
    mod: diffs.mod.size
  };

  // 更新右侧标题栏的统计
  const diffStatsEl = document.getElementById('diffStats');
  if (diffStatsEl) {
    const total = stats.add + stats.del + stats.mod;
    if (total > 0) {
      diffStatsEl.innerHTML = `<span class="diff-count-add">+${stats.add} added</span> <span class="diff-count-del">-${stats.del} removed</span> <span class="diff-count-mod">~${stats.mod} changed</span>`;
    } else {
      diffStatsEl.innerHTML = '';
    }
  }

  // 渲染 A（左侧）
  if (diffDataA !== null) {
    outputA.innerHTML = renderJson(diffDataA, diffs, 'A');
    bindToggle(outputA);
  }

  // 渲染 B（右侧）
  if (diffDataB !== null) {
    outputB.innerHTML = renderJson(diffDataB, diffs, 'B');
    bindToggle(outputB);
  }
}

/**
 * 处理粘贴事件（带大小限制）
 */
function handlePaste(e, side) {
  e.preventDefault();
  const text = e.clipboardData.getData('text').trim();

  // Y3: 粘贴内容大小限制
  if (text.length > MAX_INPUT_SIZE) {
    // 超过限制，不处理
    return;
  }

  if (side === 'A') {
    diffRawA = text;
    try {
      diffDataA = JSON.parse(text);
    } catch (e) {
      diffDataA = null;
    }
  } else {
    diffRawB = text;
    try {
      diffDataB = JSON.parse(text);
    } catch (e) {
      diffDataB = null;
    }
  }

  renderDiff();
}

/**
 * 清理 HTML 中的特殊字符，提取纯 JSON
 * 增强版：移除所有渲染相关的非 JSON 字符
 */
function cleanJsonText(text) {
  // 移除折叠符号
  text = text.replace(/[▼▶]/g, '');
  // 移除数字标记（元素数量，如单独一行的 "3"）
  text = text.replace(/^\d+$/gm, '');
  // 移除多余的空白行
  text = text.replace(/\n\s*\n/g, '\n');
  // 移除行首的多余空格（保留 JSON 结构缩进）
  // 注意：这里不能简单移除所有空格，否则会破坏 JSON 格式
  return text.trim();
}

/**
 * 保存光标位置
 */
function saveCaretPosition(element) {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);

  return preCaretRange.toString().length;
}

/**
 * 恢复光标位置（带深度限制）
 */
function restoreCaretPosition(element, position) {
  if (position === null) return;

  const selection = window.getSelection();
  const range = document.createRange();
  let charCount = 0;
  let found = false;
  let currentDepth = 0;
  const maxTraverseDepth = MAX_DEPTH;

  function traverseNodes(node) {
    // Y4: 深度限制
    if (found || currentDepth > maxTraverseDepth) return;
    currentDepth++;

    if (node.nodeType === Node.TEXT_NODE) {
      const nextCount = charCount + node.length;
      if (nextCount >= position) {
        range.setStart(node, position - charCount);
        range.collapse(true);
        found = true;
      }
      charCount = nextCount;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverseNodes(node.childNodes[i]);
        if (found) break;
      }
    }
    currentDepth--;
  }

  traverseNodes(element);

  if (found) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// Diff 输出框事件
const diffOutputA = document.getElementById('diffOutputA');
const diffOutputB = document.getElementById('diffOutputB');

// 粘贴时只更新数据，不自动对比
diffOutputA.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text').trim();
  if (text.length > MAX_INPUT_SIZE) return;
  diffOutputA.textContent = text;
  diffRawA = text;
  try {
    diffDataA = JSON.parse(text);
  } catch (e) {
    diffDataA = null;
  }
});

diffOutputB.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text').trim();
  if (text.length > MAX_INPUT_SIZE) return;
  diffOutputB.textContent = text;
  diffRawB = text;
  try {
    diffDataB = JSON.parse(text);
  } catch (e) {
    diffDataB = null;
  }
});

// 对比按钮
const compareBtn = document.getElementById('compareBtn');
compareBtn.onclick = async () => {
  // 从两侧提取 JSON
  const textA = cleanJsonText(diffOutputA.innerText);
  const textB = cleanJsonText(diffOutputB.innerText);
  const inputSize = textA.length + textB.length;

  // 检查付费限制
  const check = await canUseDiff(inputSize);
  if (!check.allowed) {
    showUpgradeDialog(check);
    return;
  }

  // 原有大小限制检查（兼容旧逻辑）
  if (textA.length > MAX_INPUT_SIZE || textB.length > MAX_INPUT_SIZE) {
    return;
  }

  try {
    diffDataA = JSON.parse(textA);
  } catch (e) {
    diffDataA = null;
  }

  try {
    diffDataB = JSON.parse(textB);
  } catch (e) {
    diffDataB = null;
  }

  diffRawA = textA;
  diffRawB = textB;
  renderDiff();

  // 记录使用次数（免费用户）
  await recordDiffUsage();

  // 显示剩余次数（免费用户）
  if (!check.isPro) {
    updateDiffUsageDisplay(check.usage + 1);
  }
};

// 交换
swapBtn.onclick = () => {
  const tempData = diffDataA;
  diffDataA = diffDataB;
  diffDataB = tempData;

  const tempRaw = diffRawA;
  diffRawA = diffRawB;
  diffRawB = tempRaw;

  renderDiff();
};

// 清空
clearDiffBtn.onclick = () => {
  diffDataA = null;
  diffDataB = null;
  diffRawA = '';
  diffRawB = '';
  diffOutputA.innerHTML = '';
  diffOutputB.innerHTML = '';
};

// ===================== 语法高亮渲染函数 =====================

/**
 * 渲染 JSON（带换行格式化，用于输入区域显示）
 * @param {*} data - JSON 数据
 * @param {number} indent - 缩进级别
 * @param {number} depth - 当前深度
 * @returns {string} HTML 字符串
 */
function renderSimpleFormatted(data, indent = 0, depth = 0) {
  const pad = '  '.repeat(indent);

  // 深度限制检查
  if (depth > MAX_DEPTH) {
    return '<span class="error" style="color: #f38ba8;">Nested too deep, truncated</span>';
  }

  if (data === null) return '<span class="v-null">null</span>';
  if (typeof data === 'string') return `<span class="v-string">"${esc(data)}"</span>`;
  if (typeof data === 'number') return `<span class="v-number">${data}</span>`;
  if (typeof data === 'boolean') return `<span class="v-bool">${data}</span>`;

  if (Array.isArray(data)) {
    if (data.length === 0) return '<span class="v-bracket">[]</span>';
    const items = data.map((v, i) => {
      const val = renderSimpleFormatted(v, indent + 1, depth + 1);
      const comma = i < data.length - 1 ? '<span class="v-comma">,</span>' : '';
      return `\n${pad}  ${val}${comma}`;
    }).join('');
    return `<span class="v-bracket">[</span>${items}\n${pad}<span class="v-bracket">]</span>`;
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return '<span class="v-bracket">{}</span>';
    const items = keys.map((k, i) => {
      const val = renderSimpleFormatted(data[k], indent + 1, depth + 1);
      const comma = i < keys.length - 1 ? '<span class="v-comma">,</span>' : '';
      return `\n${pad}  <span class="v-key">"${esc(k)}"</span>: ${val}${comma}`;
    }).join('');
    return `<span class="v-bracket">{</span>${items}\n${pad}<span class="v-bracket">}</span>`;
  }

  return String(data);
}

/**
 * 渲染 JSON（单行带语法高亮，用于压缩结果显示）
 * @param {*} data - JSON 数据
 * @param {number} depth - 当前深度
 * @returns {string} HTML 字符串
 */
function renderCompact(data, depth = 0) {
  if (depth > MAX_DEPTH) {
    return '<span class="error">Nested too deep</span>';
  }

  if (data === null) return '<span class="v-null">null</span>';
  if (typeof data === 'string') return `<span class="v-string">"${esc(data)}"</span>`;
  if (typeof data === 'number') return `<span class="v-number">${data}</span>`;
  if (typeof data === 'boolean') return `<span class="v-bool">${data}</span>`;

  if (Array.isArray(data)) {
    if (data.length === 0) return '<span class="v-bracket">[]</span>';
    const items = data.map((v, i) => {
      const val = renderCompact(v, depth + 1);
      const comma = i < data.length - 1 ? '<span class="v-comma">,</span> ' : '';
      return val + comma;
    }).join('');
    return `<span class="v-bracket">[</span>${items}<span class="v-bracket">]</span>`;
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return '<span class="v-bracket">{}</span>';
    const items = keys.map((k, i) => {
      const val = renderCompact(data[k], depth + 1);
      const comma = i < keys.length - 1 ? '<span class="v-comma">,</span> ' : '';
      return `<span class="v-key">"${esc(k)}"</span>: ${val}${comma}`;
    }).join('');
    return `<span class="v-bracket">{</span>${items}<span class="v-bracket">}</span>`;
  }

  return String(data);
}

/**
 * 自动格式化并渲染到 contenteditable 显示区域
 * @param {HTMLTextAreaElement} inputElement - 隐藏的 textarea（存储原始数据）
 * @param {HTMLElement} displayElement - contenteditable 显示区域
 */
function autoFormatAndRender(inputElement, displayElement) {
  const text = inputElement.value.trim();
  if (!text) {
    displayElement.innerHTML = '';
    return;
  }

  // 大小限制
  if (text.length > MAX_INPUT_SIZE) return;

  try {
    const obj = JSON.parse(text);
    // 更新 textarea 的值为格式化后的 JSON
    inputElement.value = JSON.stringify(obj, null, 2);
    // 渲染带语法高亮的 HTML 到显示区域
    displayElement.innerHTML = renderSimpleFormatted(obj);
  } catch (e) {
    // 解析失败，保持原样显示
    displayElement.textContent = text;
  }
}

/**
 * 自动格式化输入框内容
 * @param {HTMLTextAreaElement} inputElement - 输入框元素
 */
function autoFormatInput(inputElement) {
  const text = inputElement.value.trim();
  if (!text) return;

  // 大小限制
  if (text.length > MAX_INPUT_SIZE) return;

  try {
    const obj = JSON.parse(text);
    inputElement.value = JSON.stringify(obj, null, 2);
  } catch (e) {
    // 解析失败，保持原样
  }
}

// ===================== JSON 转换功能 =====================

/**
 * 将 JSON 转换为 TypeScript 接口（带深度限制）
 * @param {object} data - JSON 对象
 * @param {string} interfaceName - 接口名称
 * @param {number} indent - 缩进级别
 * @param {number} depth - 当前深度
 * @returns {string} TypeScript 接口定义
 */
function jsonToTypeScript(data, interfaceName = 'Root', indent = 0, depth = 0) {
  const pad = '  '.repeat(indent);

  // W2: 深度限制
  if (depth > MAX_DEPTH) {
    return `${pad}// ${interfaceName}: nested too deep, truncated\n`;
  }

  if (data === null) {
    return `${pad}type ${interfaceName} = null;\n`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return `${pad}type ${interfaceName} = any[];\n`;
    }
    // 分析数组元素类型
    const firstItem = data[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
      // 对象数组
      const itemType = `${interfaceName}Item`;
      let result = jsonToTypeScript(firstItem, itemType, indent, depth + 1);
      result += `${pad}type ${interfaceName} = ${itemType}[];\n`;
      return result;
    } else {
      // 基本类型数组
      const tsType = getTsType(firstItem);
      return `${pad}type ${interfaceName} = ${tsType}[];\n`;
    }
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return `${pad}interface ${interfaceName} {}\n`;
    }

    let result = `${pad}interface ${interfaceName} {\n`;
    for (const key of keys) {
      const value = data[key];
      const tsType = getTsTypeFromValue(value, `${interfaceName}_${capitalize(key)}`, indent);
      const optional = value === null ? '?' : '';
      // W6: 处理 key 中的特殊字符，使用有效的 TypeScript 属性名
      const safeKey = isValidIdentifier(key) ? key : `'${key.replace(/'/g, "\\'")}'`;
      result += `${pad}  ${safeKey}${optional}: ${tsType};\n`;
    }
    result += `${pad}}\n`;

    // 为嵌套对象生成类型
    for (const key of keys) {
      const value = data[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result += jsonToTypeScript(value, `${interfaceName}_${capitalize(key)}`, indent, depth + 1);
      }
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        result += jsonToTypeScript(value[0], `${interfaceName}_${capitalize(key)}Item`, indent, depth + 1);
      }
    }

    return result;
  }

  return `${pad}type ${interfaceName} = ${getTsType(data)};\n`;
}

/**
 * 检查是否为有效的标识符（用于 TypeScript 属性名）
 */
function isValidIdentifier(str) {
  // 只包含字母、数字、下划线，且不以数字开头
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}

/**
 * 获取 TypeScript 类型字符串
 */
function getTsType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'any[]';
  if (typeof value === 'object') return 'object';
  return 'any';
}

/**
 * 根据值获取 TypeScript 类型（支持嵌套类型名）
 */
function getTsTypeFromValue(value, typeName, indent) {
  if (value === null) return 'null | undefined';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'any[]';
    const firstItem = value[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
      return `${typeName}Item[]`;
    }
    return `${getTsType(firstItem)}[]`;
  }
  if (typeof value === 'object') {
    return typeName;
  }
  return 'any';
}

/**
 * 首字母大写
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 将 JSON 转换为 Go struct（带深度限制）
 * @param {object} data - JSON 对象
 * @param {string} structName - 结构体名称
 * @param {number} indent - 缩进级别
 * @param {Set} generatedStructs - 已生成的结构体（避免重复）
 * @param {number} depth - 当前深度
 * @returns {string} Go struct 定义
 */
function jsonToGo(data, structName = 'Root', indent = 0, generatedStructs = new Set(), depth = 0) {
  const pad = '\t'.repeat(indent);

  // W3: 深度限制
  if (depth > MAX_DEPTH) {
    return `${pad}// ${structName}: nested too deep, truncated\n`;
  }

  if (data === null || typeof data !== 'object') {
    return `${pad}// ${structName} is a primitive type\n`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return `${pad}type ${structName} []any\n\n`;
    }
    const firstItem = data[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
      const itemName = `${structName}Item`;
      let result = jsonToGo(firstItem, itemName, indent, generatedStructs, depth + 1);
      result = result.replace(`type ${itemName} struct`, `type ${structName} []${itemName}`);
      return result;
    } else {
      const goType = getGoType(firstItem);
      return `${pad}type ${structName} []${goType}\n\n`;
    }
  }

  // 避免重复生成
  if (generatedStructs.has(structName)) {
    return '';
  }
  generatedStructs.add(structName);

  const keys = Object.keys(data);
  if (keys.length === 0) {
    return `${pad}type ${structName} struct {}\n\n`;
  }

  let result = `${pad}type ${structName} struct {\n`;
  for (const key of keys) {
    const value = data[key];
    const goType = getGoTypeFromValue(value, `${structName}${capitalize(key)}`, indent, generatedStructs);
    // W5: 转义 json tag 中的特殊字符
    const jsonTag = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const fieldName = capitalize(key);
    result += `${pad}\t${fieldName} ${goType} \`json:"${jsonTag}"\`\n`;
  }
  result += `${pad}}\n\n`;

  // 为嵌套对象生成结构体
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result += jsonToGo(value, `${structName}${capitalize(key)}`, indent, generatedStructs, depth + 1);
    }
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
      result += jsonToGo(value[0], `${structName}${capitalize(key)}Item`, indent, generatedStructs, depth + 1);
    }
  }

  return result;
}

/**
 * 获取 Go 类型字符串
 */
function getGoType(value) {
  if (value === null) return 'any';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') {
    // 判断是整数还是浮点数
    if (Number.isInteger(value)) return 'int64';
    return 'float64';
  }
  if (typeof value === 'boolean') return 'bool';
  if (Array.isArray(value)) return '[]any';
  if (typeof value === 'object') return 'struct{}';
  return 'any';
}

/**
 * 根据值获取 Go 类型（支持嵌套结构体名）
 */
function getGoTypeFromValue(value, typeName, indent, generatedStructs) {
  if (value === null) return 'any';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return 'int64';
    return 'float64';
  }
  if (typeof value === 'boolean') return 'bool';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]any';
    const firstItem = value[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
      return `[]${typeName}Item`;
    }
    return `[]${getGoType(firstItem)}`;
  }
  if (typeof value === 'object') {
    return typeName;
  }
  return 'any';
}

/**
 * 将 JSON 转换为 YAML（完善字符串转义，带深度限制）
 * @param {object} data - JSON 对象
 * @param {number} indent - 缩进级别
 * @param {number} depth - 当前深度
 * @param {boolean} inArray - 是否在数组内
 * @returns {string} YAML 字符串
 */
function jsonToYaml(data, indent = 0, depth = 0, inArray = false) {
  // A1: 深度限制
  if (depth > MAX_DEPTH) {
    return '# nested too deep, truncated';
  }

  const pad = '  '.repeat(indent);

  if (data === null) {
    return 'null';
  }

  if (typeof data === 'string') {
    // W9: 完善 YAML 特殊字符转义
    const needsQuote = /[:#"'\n\t{}[\]&*?|<>=!%@`]/.test(data) ||
                       /^[-?]$/.test(data) ||
                       /^[-?]\s/.test(data) ||
                       /\s$/.test(data) ||
                       /^\s/.test(data) ||
                       /^[0-9]+$/.test(data) ||
                       data === 'true' || data === 'false' || data === 'null' || data === '~';

    if (needsQuote) {
      const escaped = data
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      return `"${escaped}"`;
    }
    return data;
  }

  if (typeof data === 'number') {
    return String(data);
  }

  if (typeof data === 'boolean') {
    return data ? 'true' : 'false';
  }

  // A2: split 行数限制常量
  const MAX_YAML_LINES = 10000;

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '[]';
    }
    const lines = [];
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (typeof item === 'object' && item !== null) {
        // 对象元素：- 后面跟第一个属性，其余属性换行
        const itemLines = jsonToYaml(item, indent + 1, depth + 1, true).split('\n');
        const limitedLines = itemLines.slice(0, MAX_YAML_LINES);
        if (limitedLines.length > 0) {
          lines.push(`${pad}- ${limitedLines[0].trim()}`);
          for (let j = 1; j < limitedLines.length; j++) {
            lines.push(`${pad}  ${limitedLines[j].trim()}`);
          }
        }
      } else {
        // 简单值
        lines.push(`${pad}- ${jsonToYaml(item, 0, depth + 1)}`);
      }
    }
    return lines.join('\n');
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return '{}';
    }

    const lines = [];
    for (const key of keys) {
      const value = data[key];
      if (value === null) {
        lines.push(`${pad}${key}: null`);
      } else if (Array.isArray(value) && value.length === 0) {
        lines.push(`${pad}${key}: []`);
      } else if (typeof value === 'object' && Object.keys(value).length === 0) {
        lines.push(`${pad}${key}: {}`);
      } else if (typeof value === 'object' && value !== null) {
        // 嵌套对象或数组
        const valueLines = jsonToYaml(value, indent + 1, depth + 1).split('\n');
        const limitedLines = valueLines.slice(0, MAX_YAML_LINES);
        lines.push(`${pad}${key}:`);
        for (const line of limitedLines) {
          lines.push(line);
        }
      } else {
        // 简单值
        lines.push(`${pad}${key}: ${jsonToYaml(value, 0, depth + 1)}`);
      }
    }
    return lines.join('\n');
  }

  return String(data);
}

/**
 * TypeScript 语法高亮
 * @param {string} code - TypeScript 代码
 * @returns {string} HTML 字符串
 */
function highlightTypeScript(code) {
  // 先转义 HTML 特殊字符
  let result = esc(code);

  // 高亮注释
  result = result.replace(/(\/\/[^\n]*)/g, '<span style="color:#a6e3a1;">$1</span>');

  // 高亮字符串（单引号内容）
  result = result.replace(/('[^']*')/g, '<span style="color:#fab387;">$1</span>');

  // 高亮关键字
  const keywords = ['interface', 'type', 'extends', 'const', 'let', 'var',
    'function', 'return', 'if', 'else', 'for', 'while', 'class', 'new',
    'import', 'export', 'from', 'default', 'async', 'await', 'readonly'];
  keywords.forEach(kw => {
    result = result.replace(new RegExp(`\\b${kw}\\b`, 'g'), '<span style="color:#89b4fa;">' + kw + '</span>');
  });

  // 高亮类型
  const types = ['string', 'number', 'boolean', 'null', 'undefined', 'any', 'void',
    'never', 'object', 'unknown', 'bigint', 'symbol'];
  types.forEach(t => {
    result = result.replace(new RegExp(`\\b${t}\\b`, 'g'), '<span style="color:#cba6f7;">' + t + '</span>');
  });

  return result;
}

/**
 * Go 语法高亮
 * @param {string} code - Go 代码
 * @returns {string} HTML 字符串
 */
function highlightGo(code) {
  let result = esc(code);

  // 高亮注释
  result = result.replace(/(\/\/[^\n]*)/g, '<span style="color:#a6e3a1;">$1</span>');

  // 高亮 json tag
  result = result.replace(/(`json:"[^"]*"`)/g, '<span style="color:#fab387;">$1</span>');

  // 高亮关键字
  const keywords = ['package', 'import', 'func', 'return', 'var', 'const', 'type',
    'struct', 'interface', 'map', 'chan', 'if', 'else', 'for', 'range',
    'switch', 'case', 'default', 'break', 'continue', 'go', 'defer', 'select'];
  keywords.forEach(kw => {
    result = result.replace(new RegExp(`\\b${kw}\\b`, 'g'), '<span style="color:#89b4fa;">' + kw + '</span>');
  });

  // 高亮类型
  const types = ['string', 'int', 'int8', 'int16', 'int32', 'int64',
    'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uintptr',
    'float32', 'float64', 'bool', 'byte', 'rune', 'error', 'any'];
  types.forEach(t => {
    result = result.replace(new RegExp(`\\b${t}\\b`, 'g'), '<span style="color:#cba6f7;">' + t + '</span>');
  });

  return result;
}

/**
 * YAML 语法高亮
 * @param {string} code - YAML 代码
 * @returns {string} HTML 字符串
 */
function highlightYaml(code) {
  const lines = code.split('\n');
  const result = [];

  for (let line of lines) {
    let highlighted = esc(line);

    // 高亮注释
    const commentIndex = line.indexOf('#');
    if (commentIndex >= 0) {
      const beforeComment = line.substring(0, commentIndex);
      const quoteCount = (beforeComment.match(/"/g) || []).length;
      if (quoteCount % 2 === 0) {
        highlighted = esc(beforeComment) + `<span style="color:#a6e3a1;">${esc(line.substring(commentIndex))}</span>`;
        result.push(highlighted);
        continue;
      }
    }

    // 高亮键名（冒号前）
    const colonMatch = highlighted.match(/^(\s*)([\w.-]+)(:\s*)/);
    if (colonMatch) {
      const indent = colonMatch[1];
      const key = colonMatch[2];
      const colon = colonMatch[3];
      const rest = highlighted.substring(colonMatch[0].length);
      highlighted = indent + `<span style="color:#74c7ec;">${key}</span>` + colon + rest;
    }

    // 高亮布尔值和 null（在行尾）
    highlighted = highlighted.replace(/:\s*(true|false|null)\s*$/g, ': <span style="color:#89b4fa;">$1</span>');

    // 高亮数字（在行尾）
    highlighted = highlighted.replace(/:\s*(-?\d+\.?\d*)\s*$/g, ': <span style="color:#94e2d5;">$1</span>');

    // 高亮列表标记
    highlighted = highlighted.replace(/^(\s*)(-)(\s)/, '$1<span style="color:#f9e2af;">-</span>$3');

    result.push(highlighted);
  }

  return result.join('\n');
}

/**
 * 执行转换（带输入大小限制）
 */
function doConvert() {
  const text = convertInput.value.trim();
  if (!text) {
    convertResult.innerHTML = '';
    return;
  }

  // 输入大小检查
  if (text.length > MAX_INPUT_SIZE) {
    convertResult.innerHTML = `<span class="error">Input too large (${(text.length / 1024 / 1024).toFixed(2)}MB), please limit to 1MB</span>`;
    return;
  }

  try {
    const data = JSON.parse(text);
    let result = '';
    let highlighted = '';

    switch (currentConvertType) {
      case 'typescript':
        result = jsonToTypeScript(data);
        highlighted = highlightTypeScript(result);
        break;
      case 'go':
        result = jsonToGo(data);
        highlighted = highlightGo(result);
        break;
      case 'yaml':
        result = jsonToYaml(data);
        highlighted = highlightYaml(result);
        break;
    }

    // A3: 转换结果大小限制（1MB）
    const MAX_CONVERT_RESULT_SIZE = 1024 * 1024;
    if (result.length > MAX_CONVERT_RESULT_SIZE) {
      convertResult.innerHTML = `<span class="error">Result too large (${(result.length / 1024 / 1024).toFixed(2)}MB), truncated</span>`;
    } else {
      convertResult.innerHTML = highlighted;
    }
  } catch (e) {
    convertResult.innerHTML = `<span class="error">Parse failed: ${esc(e.message)}</span>`;
  }
}

// 转换类型标签点击
document.querySelectorAll('.convert-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.convert-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentConvertType = tab.dataset.type;
    doConvert();
  };
});

// 输入框事件（带自动格式化和语法高亮）
const convertOutputDisplay = document.getElementById('convertOutputDisplay');
convertInput.addEventListener('input', () => {
  clearTimeout(convertInput._timer);
  convertInput._timer = setTimeout(() => {
    autoFormatAndRender(convertInput, convertOutputDisplay);
    doConvert();
  }, 300);
});

// 粘贴事件处理
convertOutputDisplay.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text').trim();
  if (text.length > MAX_INPUT_SIZE) return;
  convertInput.value = text;
  autoFormatAndRender(convertInput, convertOutputDisplay);
  doConvert();
});

// 清空
clearConvertBtn.onclick = () => {
  convertInput.value = '';
  convertOutputDisplay.innerHTML = '';
  convertResult.textContent = '';
};

// 复制
copyConvertBtn.onclick = async () => {
  const text = convertResult.textContent;
  if (text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast();
    } catch (e) {
      // Z4: 剪贴板写入失败处理
    }
  }
};

// ===================== JSON Path 功能 =====================

const pathInput = document.getElementById('pathInput');
const pathExpr = document.getElementById('pathExpr');
const pathResult = document.getElementById('pathResult');
const clearPathBtn = document.getElementById('clearPathBtn');
const queryPathBtn = document.getElementById('queryPathBtn');

let pathData = null;

/**
 * 简易 JSON Path 解析器
 * 支持语法：
 * - $ : 根节点
 * - .key : 对象属性
 * - [n] : 数组索引
 * - .. : 递归下降
 * - [*] : 所有数组元素
 * - .* : 所有对象属性
 * - [a,b] : 多个索引
 */
function jsonPath(data, path) {
  if (!path || path === '$') return [data];

  // 解析路径
  const tokens = tokenize(path);

  let results = [data];

  for (const token of tokens) {
    const newResults = [];

    for (const result of results) {
      if (result === null || result === undefined) continue;

      if (token.type === 'key') {
        // 对象属性
        // V5: 使用 hasOwnProperty 防止原型链污染
        if (typeof result === 'object' && !Array.isArray(result) && Object.prototype.hasOwnProperty.call(result, token.value)) {
          newResults.push(result[token.value]);
        }
      } else if (token.type === 'index') {
        // 数组索引
        if (Array.isArray(result)) {
          if (token.value === '*') {
            // [*] 所有元素
            newResults.push(...result);
          } else if (typeof token.value === 'number') {
            // 正索引检查
            if (token.value >= 0 && token.value < result.length) {
              newResults.push(result[token.value]);
            } else if (token.value < 0) {
              // 负索引边界检查：-1 表示最后一个元素，-length 表示第一个元素
              const actualIndex = result.length + token.value;
              if (actualIndex >= 0 && actualIndex < result.length) {
                newResults.push(result[actualIndex]);
              }
              // 越界的负索引直接忽略，不报错
            }
          } else if (Array.isArray(token.value)) {
            // 多个索引 [a,b,c]
            for (const idx of token.value) {
              if (idx >= 0 && idx < result.length) {
                newResults.push(result[idx]);
              } else if (idx < 0) {
                // 负索引边界检查
                const actualIndex = result.length + idx;
                if (actualIndex >= 0 && actualIndex < result.length) {
                  newResults.push(result[actualIndex]);
                }
              }
            }
          }
        }
      } else if (token.type === 'all') {
        // .* 或 [*] 所有属性/元素
        if (Array.isArray(result)) {
          newResults.push(...result);
        } else if (typeof result === 'object') {
          newResults.push(...Object.values(result));
        }
      } else if (token.type === 'recursive') {
        // .. 递归下降
        const key = token.value;
        if (key === '*') {
          // ..* 获取所有值
          collectAll(result, newResults);
        } else {
          // ..key 查找所有匹配的 key
          findRecursive(result, key, newResults);
        }
      }
    }

    results = newResults;
  }

  return results;
}

/**
 * 解析路径为 token 数组（带循环保护）
 */
function tokenize(path) {
  const tokens = [];
  let i = 0;

  // 跳过 $
  if (path[0] === '$') i = 1;

  // Y5: 循环保护 - 最大迭代次数
  const maxIterations = 1000;
  let iterations = 0;

  while (i < path.length && iterations < maxIterations) {
    iterations++;

    if (path[i] === '.') {
      if (path[i + 1] === '.') {
        // 递归下降 ..
        i += 2;
        let key = '';
        let keyIterations = 0;
        while (i < path.length && path[i] !== '.' && path[i] !== '[' && keyIterations < maxIterations) {
          keyIterations++;
          key += path[i];
          i++;
        }
        tokens.push({ type: 'recursive', value: key || '*' });
      } else {
        // 属性访问
        i++;
        if (path[i] === '*') {
          tokens.push({ type: 'all', value: '*' });
          i++;
        } else {
          let key = '';
          let keyIterations = 0;
          while (i < path.length && path[i] !== '.' && path[i] !== '[' && keyIterations < maxIterations) {
            keyIterations++;
            key += path[i];
            i++;
          }
          if (key) tokens.push({ type: 'key', value: key });
        }
      }
    } else if (path[i] === '[') {
      i++;
      let content = '';
      let contentIterations = 0;
      while (i < path.length && path[i] !== ']' && contentIterations < maxIterations) {
        contentIterations++;
        content += path[i];
        i++;
      }
      i++; // 跳过 ]

      if (content === '*') {
        tokens.push({ type: 'all', value: '*' });
      } else if (content.includes(',')) {
        // 多个索引
        const indices = content.split(',').map(s => parseInt(s.trim()));
        tokens.push({ type: 'index', value: indices });
      } else {
        const idx = parseInt(content);
        tokens.push({ type: 'index', value: isNaN(idx) ? content : idx });
      }
    } else {
      i++;
    }
  }

  return tokens;
}

/**
 * 递归查找所有匹配的 key（带深度限制）
 */
function findRecursive(obj, key, results, depth = 0) {
  // V1: 深度限制
  if (depth > MAX_DEPTH) return;
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      findRecursive(item, key, results, depth + 1);
    }
  } else if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (k === key) {
        results.push(v);
      }
      findRecursive(v, key, results, depth + 1);
    }
  }
}

/**
 * 收集所有值（带深度限制）
 */
function collectAll(obj, results, depth = 0) {
  // V1: 深度限制
  if (depth > MAX_DEPTH) return;
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(item);
      collectAll(item, results, depth + 1);
    }
  } else if (typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      results.push(v);
      collectAll(v, results, depth + 1);
    }
  }
}

/**
 * 执行 JSON Path 查询（带输入大小限制）
 */
function queryPath() {
  const text = pathInput.value.trim();
  const expr = pathExpr.value.trim();

  if (!text) {
    pathResult.innerHTML = '<div class="error">Please enter JSON</div>';
    return;
  }

  // 输入大小检查
  if (text.length > MAX_INPUT_SIZE) {
    pathResult.innerHTML = `<div class="error">Input too large (${(text.length / 1024 / 1024).toFixed(2)}MB), please limit to 1MB</div>`;
    return;
  }

  if (!expr) {
    pathResult.innerHTML = '<div class="error">Please enter JSON Path expression</div>';
    return;
  }

  // X4: JSON Path 表达式长度限制（1000字符）
  const MAX_PATH_EXPR_LENGTH = 1000;
  if (expr.length > MAX_PATH_EXPR_LENGTH) {
    pathResult.innerHTML = `<div class="error">Path expression too long (${expr.length} chars), max ${MAX_PATH_EXPR_LENGTH} chars</div>`;
    return;
  }

  try {
    pathData = JSON.parse(text);
  } catch (e) {
    pathResult.innerHTML = `<div class="error">JSON parse failed: ${esc(e.message)}</div>`;
    return;
  }

  try {
    const results = jsonPath(pathData, expr);

    if (results.length === 0) {
      pathResult.innerHTML = '<div class="error">No matches found</div>';
      return;
    }

    // 渲染结果
    let html = `<div style="color: #a6e3a1; margin-bottom: 8px;">Found ${results.length} results:</div>`;
    results.forEach((r, i) => {
      html += `<div style="margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">`;
      html += `<div style="color: #6c7086; font-size: 11px; margin-bottom: 4px;">[${i}]</div>`;
      html += render(r);
      html += `</div>`;
    });
    pathResult.innerHTML = html;
  } catch (e) {
    // X1: 错误信息转义
    pathResult.innerHTML = `<div class="error">Query failed: ${esc(e.message)}</div>`;
  }
}

// Path 输入框事件（带自动格式化和语法高亮）
const pathOutputDisplay = document.getElementById('pathOutputDisplay');
pathInput.addEventListener('input', () => {
  clearTimeout(pathInput._timer);
  pathInput._timer = setTimeout(() => {
    autoFormatAndRender(pathInput, pathOutputDisplay);
    queryPath();
  }, 500);
});

// 粘贴事件处理
pathOutputDisplay.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text').trim();
  if (text.length > MAX_INPUT_SIZE) return;
  pathInput.value = text;
  autoFormatAndRender(pathInput, pathOutputDisplay);
  queryPath();
});

pathExpr.addEventListener('input', () => {
  clearTimeout(pathExpr._timer);
  pathExpr._timer = setTimeout(queryPath, 300);
});

pathExpr.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') queryPath();
});

queryPathBtn.onclick = queryPath;

clearPathBtn.onclick = () => {
  pathInput.value = '';
  pathOutputDisplay.innerHTML = '';
  pathExpr.value = '';
  pathResult.innerHTML = '';
  pathData = null;
};

// ===================== JSON 压缩/转义功能 =====================

const compactInput = document.getElementById('compactInput');
const compactOutput = document.getElementById('compactOutput');
const clearCompactBtn = document.getElementById('clearCompactBtn');
const compactBtn = document.getElementById('compactBtn');
const escapeBtn = document.getElementById('escapeBtn');
const unescapeBtn = document.getElementById('unescapeBtn');
const copyCompactBtn = document.getElementById('copyCompactBtn');

// 压缩模式输入框自动格式化和语法高亮
const compactOutputDisplay = document.getElementById('compactOutputDisplay');
compactInput.addEventListener('input', () => {
  clearTimeout(compactInput._timer);
  compactInput._timer = setTimeout(() => {
    autoFormatAndRender(compactInput, compactOutputDisplay);
  }, 500);
});

// 粘贴事件处理
compactOutputDisplay.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = e.clipboardData.getData('text').trim();
  if (text.length > MAX_INPUT_SIZE) return;
  compactInput.value = text;
  autoFormatAndRender(compactInput, compactOutputDisplay);
});

// 压缩模式结果显示区域
const compactResultDisplay = document.getElementById('compactResultDisplay');

/**
 * JSON 压缩（去除空格换行，带输入大小限制）
 */
function compactJson() {
  const text = compactInput.value.trim();
  if (!text) {
    compactOutput.value = '';
    compactResultDisplay.innerHTML = '';
    return;
  }

  // 输入大小检查
  if (text.length > MAX_INPUT_SIZE) {
    const errMsg = `输入过大 (${(text.length / 1024 / 1024).toFixed(2)}MB)，请限制在 1MB 以内`;
    compactOutput.value = errMsg;
    compactResultDisplay.innerHTML = `<span class="error">${esc(errMsg)}</span>`;
    return;
  }

  try {
    const obj = JSON.parse(text);
    const compacted = JSON.stringify(obj);
    compactOutput.value = compacted;
    // 压缩后的 JSON 显示语法高亮（单行格式）
    compactResultDisplay.innerHTML = renderCompact(obj);
  } catch (e) {
    const errMsg = `解析失败: ${esc(e.message)}`;
    compactOutput.value = errMsg;
    compactResultDisplay.innerHTML = `<span class="error">${errMsg}</span>`;
  }
}

/**
 * JSON 转义（转为字符串，带输入大小限制）
 */
function escapeJson() {
  const text = compactInput.value.trim();
  if (!text) {
    compactOutput.value = '';
    compactResultDisplay.innerHTML = '';
    return;
  }

  // 输入大小检查
  if (text.length > MAX_INPUT_SIZE) {
    const errMsg = `输入过大 (${(text.length / 1024 / 1024).toFixed(2)}MB)，请限制在 1MB 以内`;
    compactOutput.value = errMsg;
    compactResultDisplay.innerHTML = `<span class="error">${esc(errMsg)}</span>`;
    return;
  }

  try {
    // 先验证是否为有效 JSON
    const obj = JSON.parse(text);
    // 转义：将 JSON 字符串化后再转义引号
    const jsonStr = JSON.stringify(obj);
    // 转义特殊字符
    const escaped = jsonStr
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
    compactOutput.value = escaped;
    // 转义结果显示为字符串（橙色）
    compactResultDisplay.innerHTML = `<span class="v-string">"${esc(escaped)}"</span>`;
  } catch (e) {
    const errMsg = `解析失败: ${esc(e.message)}`;
    compactOutput.value = errMsg;
    compactResultDisplay.innerHTML = `<span class="error">${errMsg}</span>`;
  }
}

/**
 * JSON 反转义（从字符串还原，带输入大小限制）
 */
function unescapeJson() {
  const text = compactInput.value.trim();
  if (!text) {
    compactOutput.value = '';
    compactResultDisplay.innerHTML = '';
    return;
  }

  // 输入大小检查
  if (text.length > MAX_INPUT_SIZE) {
    const errMsg = `输入过大 (${(text.length / 1024 / 1024).toFixed(2)}MB)，请限制在 1MB 以内`;
    compactOutput.value = errMsg;
    compactResultDisplay.innerHTML = `<span class="error">${esc(errMsg)}</span>`;
    return;
  }

  try {
    // 反转义特殊字符
    let unescaped = text
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    // Z3: 反转义后大小限制（反转义可能使内容变大）
    if (unescaped.length > MAX_INPUT_SIZE) {
      const errMsg = `反转义后内容过大，请限制在 1MB 以内`;
      compactOutput.value = errMsg;
      compactResultDisplay.innerHTML = `<span class="error">${errMsg}</span>`;
      return;
    }
    // 尝试解析并格式化
    const obj = JSON.parse(unescaped);
    const formatted = JSON.stringify(obj, null, 2);
    compactOutput.value = formatted;
    // 反转义后显示语法高亮
    compactResultDisplay.innerHTML = renderSimpleFormatted(obj);
  } catch (e) {
    const errMsg = `反转义失败: ${esc(e.message)}`;
    compactOutput.value = errMsg;
    compactResultDisplay.innerHTML = `<span class="error">${errMsg}</span>`;
  }
}

compactBtn.onclick = compactJson;
escapeBtn.onclick = escapeJson;
unescapeBtn.onclick = unescapeJson;

clearCompactBtn.onclick = () => {
  compactInput.value = '';
  compactOutputDisplay.innerHTML = '';
  compactOutput.value = '';
  compactResultDisplay.innerHTML = '';
};

copyCompactBtn.onclick = async () => {
  const text = compactOutput.value;
  if (text && !text.startsWith('解析失败') && !text.startsWith('反转义失败') && !text.startsWith('输入过大') && !text.startsWith('反转义后')) {
    try {
      await navigator.clipboard.writeText(text);
      showToast();
    } catch (e) {
      // Z4: 剪贴板写入失败处理
    }
  }
};

// ===================== 付费升级功能 =====================

/**
 * 更新 Diff 使用次数显示
 * @param {number} usage - 当前使用次数
 */
function updateDiffUsageDisplay(usage) {
  // 在 Diff 模式标题栏显示剩余次数
  const diffStats = document.getElementById('diffStats');
  if (diffStats) {
    const remaining = FREE_DIFF_LIMIT - usage;
    if (remaining > 0) {
      diffStats.innerHTML = `<span style="color:#6c7086;">${remaining} left</span> ` + diffStats.innerHTML;
    }
  }
}
