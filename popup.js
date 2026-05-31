/**
 * JSON Formatter - Popup Script
 */

const input = document.getElementById('input');
const output = document.getElementById('output');
const tzSelect = document.getElementById('tzSelect');
const formatBtn = document.getElementById('formatBtn');
const formatTsBtn = document.getElementById('formatTsBtn');
const expandBtn = document.getElementById('expandBtn');
const collapseBtn = document.getElementById('collapseBtn');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');
const toast = document.getElementById('toast');

// Diff 模式元素
const modeFormatBtn = document.getElementById('modeFormatBtn');
const modeDiffBtn = document.getElementById('modeDiffBtn');
const formatMode = document.getElementById('formatMode');
const diffMode = document.getElementById('diffMode');
const diffInputA = document.getElementById('diffInputA');
const diffInputB = document.getElementById('diffInputB');
const swapBtn = document.getElementById('swapBtn');
const clearDiffBtn = document.getElementById('clearDiffBtn');

let formattedJson = '';
let idCounter = 0;

// ===================== 历史记录 =====================

const MAX_HISTORY = 50;

/**
 * 保存到历史记录
 * @param {string} jsonText - JSON 文本
 * @param {string} source - 来源: 'manual' | 'right-click'
 */
async function saveToHistory(jsonText, source = 'manual') {
  if (!jsonText || jsonText.trim().length < 2) return;

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
      source: source,
      time: new Date().toISOString(),
      preview: jsonText.substring(0, 60).replace(/\n/g, ' ')
    });

    // 限制条数
    const limited = history.slice(0, MAX_HISTORY);
    await chrome.storage.local.set({ history: limited });
  } catch (e) {
    console.error('保存历史记录失败:', e);
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
      tzSelect.value = saved.tzOffset;
    }
    // 如果有选中的 JSON，自动填入并格式化
    if (saved.jsonText) {
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

// HTML 转义
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 渲染 JSON
function render(data) {
  if (data === null) return '<span class="v-null">null</span>';
  if (typeof data === 'string') return `<span class="v-string">"${esc(data)}"</span>`;
  if (typeof data === 'number') {
    const isTs = (data > 1000000000 && data < 100000000000) ||
                 (data > 1000000000000 && data < 10000000000000);
    if (isTs) {
      return `<span class="v-number v-ts" data-ts="${data}">${data}</span>`;
    }
    return `<span class="v-number">${data}</span>`;
  }
  if (typeof data === 'boolean') return `<span class="v-bool">${data}</span>`;

  if (Array.isArray(data)) {
    if (data.length === 0) return '<span class="v-bracket">[]</span>';
    const id = 'n' + (idCounter++);
    const items = data.map((v, i) => {
      const val = render(v);
      const comma = i < data.length - 1 ? '<span class="v-comma">,</span>' : '';
      return `<div class="line">${val}${comma}</div>`;
    }).join('');
    return `<span class="toggle" data-id="${id}">▼</span><span class="v-bracket">[</span><span class="v-count">${data.length}</span><div class="block" id="${id}">${items}</div><span class="v-bracket">]</span>`;
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return '<span class="v-bracket">{}</span>';
    const id = 'n' + (idCounter++);
    const items = keys.map((k, i) => {
      const val = render(data[k]);
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
      const block = document.getElementById(el.dataset.id);
      const hide = block.classList.toggle('hide');
      el.textContent = hide ? '▶' : '▼';
    };
  });

  // 点击时间戳
  output.querySelectorAll('.v-ts').forEach(el => {
    el.onclick = () => {
      const ts = el.dataset.ts;
      const tz = Number(tzSelect.value);
      const isFmt = el.classList.toggle('formatted');
      el.textContent = isFmt ? formatTs(Number(ts), tz) : ts;
    };
  });
}

// 格式化
function format() {
  const text = input.value.trim();
  if (!text) return;

  idCounter = 0;

  try {
    const obj = JSON.parse(text);
    formattedJson = JSON.stringify(obj, null, 2);
    output.innerHTML = render(obj);
    bindEvents();
    // 保存到历史记录
    saveToHistory(text, 'manual');
  } catch (e) {
    output.innerHTML = `<div class="error">解析失败: ${e.message}</div>`;
    formattedJson = '';
  }
}

// 格式化所有时间戳
function formatAllTs() {
  const tz = Number(tzSelect.value);
  const all = output.querySelectorAll('.v-ts');
  if (!all.length) return;

  const allFmt = Array.from(all).every(el => el.classList.contains('formatted'));

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

// 复制
async function copy() {
  if (!formattedJson) return;
  await navigator.clipboard.writeText(formattedJson);
  showToast();
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
  chrome.storage.local.set({ tzOffset: tzSelect.value });
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

function hideFormatButtons(hide) {
  document.getElementById('tzSelect').style.display = hide ? 'none' : '';
  document.getElementById('formatBtn').style.display = hide ? 'none' : '';
  document.getElementById('formatTsBtn').style.display = hide ? 'none' : '';
  document.getElementById('expandBtn').style.display = hide ? 'none' : '';
  document.getElementById('collapseBtn').style.display = hide ? 'none' : '';
  document.getElementById('copyBtn').style.display = hide ? 'none' : '';
  document.getElementById('clearBtn').style.display = hide ? 'none' : '';
}

function switchMode(mode) {
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

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';

  return date.toLocaleDateString('zh-CN');
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

/**
 * 渲染历史记录列表
 */
async function renderHistoryList() {
  const history = await getHistory();
  const tzOffset = Number(tzSelect.value);

  if (history.length === 0) {
    historyList.innerHTML = '<div class="history-empty">暂无历史记录</div>';
    return;
  }

  historyList.innerHTML = history.map((item, index) => `
    <div class="history-item" data-index="${index}">
      <span class="history-icon ${item.source}">${item.source === 'right-click' ? '🔗' : '📋'}</span>
      <div class="history-content">
        <div class="history-preview">${escDiff(item.preview)}...</div>
        <div class="history-meta">
          <span class="history-time">${formatFullTime(item.time, tzOffset)}</span>
          <span class="history-source">${item.source === 'right-click' ? '右键' : '手动'}</span>
        </div>
      </div>
      <button class="history-delete" data-index="${index}">删除</button>
    </div>
  `).join('');

  // 绑定点击事件
  historyList.querySelectorAll('.history-item').forEach(el => {
    el.onclick = (e) => {
      if (e.target.classList.contains('history-delete')) return;
      const index = parseInt(el.dataset.index);
      loadHistoryItem(index);
    };
  });

  // 绑定删除事件
  historyList.querySelectorAll('.history-delete').forEach(el => {
    el.onclick = async (e) => {
      e.stopPropagation();
      const index = parseInt(el.dataset.index);
      await deleteHistoryItem(index);
      renderHistoryList();
    };
  });
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
function openHistoryDrawer() {
  historyPanel.classList.add('show');
  historyOverlay.classList.add('show');
  renderHistoryList();
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
  if (confirm('确定要清空所有历史记录吗？')) {
    await clearHistory();
    renderHistoryList();
  }
};

// ===================== JSON Diff 功能 =====================

let diffIdCounter = 0;
let diffDataA = null;
let diffDataB = null;
let diffRawA = '';  // 原始 JSON 字符串
let diffRawB = '';

/**
 * HTML 转义
 */
function escDiff(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 深度比较收集差异路径
 */
function collectDiffs(a, b, path = '') {
  const result = { add: new Set(), del: new Set(), mod: new Set() };

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

  // 基本类型
  if (typeA !== 'object') {
    if (a !== b) {
      result.mod.add(path);
    }
    return result;
  }

  // 数组
  if (typeA === 'array') {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      const p = path ? `${path}.${i}` : String(i);
      const sub = collectDiffs(a[i], b[i], p);
      result.add = new Set([...result.add, ...sub.add]);
      result.del = new Set([...result.del, ...sub.del]);
      result.mod = new Set([...result.mod, ...sub.mod]);
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
      const sub = collectDiffs(a[k], b[k], p);
      result.add = new Set([...result.add, ...sub.add]);
      result.del = new Set([...result.del, ...sub.del]);
      result.mod = new Set([...result.mod, ...sub.mod]);
    }
  }

  return result;
}

/**
 * 渲染 JSON（带差异高亮）
 */
function renderJson(data, diffs, side, path = '', indent = 0) {
  const pad = '  '.repeat(indent);
  const isA = side === 'A';

  if (data === null) return `<span class="v-null">null</span>`;
  if (typeof data === 'string') return `<span class="v-string">"${escDiff(data)}"</span>`;
  if (typeof data === 'number') return `<span class="v-number">${data}</span>`;
  if (typeof data === 'boolean') return `<span class="v-bool">${data}</span>`;

  if (Array.isArray(data)) {
    if (data.length === 0) return `<span class="v-bracket">[]</span>`;
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
      return `<div class="line ${lineClass}">${pad}  ${renderJson(v, diffs, side, p, indent + 1)}${i < data.length - 1 ? '<span class="v-comma">,</span>' : ''}</div>`;
    }).join('');
    return `<span class="toggle" data-id="${id}">▼</span><span class="v-bracket">[</span><div class="block" id="${id}">${items}</div><span class="v-bracket">]</span>`;
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return `<span class="v-bracket">{}</span>`;
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

      return `<div class="line ${lineClass}">${pad}  <span class="v-key">"${escDiff(k)}"</span>: ${renderJson(data[k], diffs, side, p, indent + 1)}${i < keys.length - 1 ? '<span class="v-comma">,</span>' : ''}</div>`;
    }).join('');
    return `<span class="toggle" data-id="${id}">▼</span><span class="v-bracket">{</span><div class="block" id="${id}">${items}</div><span class="v-bracket">}</span>`;
  }

  return String(data);
}

/**
 * 绑定折叠事件
 */
function bindToggle(container) {
  container.querySelectorAll('.toggle').forEach(el => {
    el.onclick = () => {
      const block = document.getElementById(el.dataset.id);
      const hide = block.classList.toggle('hide');
      el.textContent = hide ? '▶' : '▼';
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

  // 调试
  console.log('=== renderDiff ===');
  console.log('diffDataA:', diffDataA);
  console.log('diffDataB:', diffDataB);
  console.log('diffs:', { add: [...diffs.add], del: [...diffs.del], mod: [...diffs.mod] });

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
 * 处理粘贴事件
 */
function handlePaste(e, side) {
  e.preventDefault();
  const text = e.clipboardData.getData('text').trim();

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
 */
function cleanJsonText(text) {
  // 移除折叠符号
  text = text.replace(/[▼▶]/g, '');
  // 移除数字标记如 "3" 等（元素数量）
  text = text.replace(/^\d+$/gm, '');
  return text.trim();
}

// Diff 输出框事件
const diffOutputA = document.getElementById('diffOutputA');
const diffOutputB = document.getElementById('diffOutputB');

diffOutputA.addEventListener('paste', (e) => handlePaste(e, 'A'));
diffOutputB.addEventListener('paste', (e) => handlePaste(e, 'B'));

// 监听 keyup 事件（只更新数据，不渲染）
let keyupTimer = null;
diffOutputA.addEventListener('keyup', () => {
  clearTimeout(keyupTimer);
  keyupTimer = setTimeout(() => {
    const text = cleanJsonText(diffOutputA.innerText);
    try {
      diffDataA = JSON.parse(text);
      diffRawA = text;
      // 不重新渲染，避免光标跳转
      updateDiffStatsOnly();
    } catch (e) {}
  }, 500);
});

diffOutputB.addEventListener('keyup', () => {
  clearTimeout(keyupTimer);
  keyupTimer = setTimeout(() => {
    const text = cleanJsonText(diffOutputB.innerText);
    try {
      diffDataB = JSON.parse(text);
      diffRawB = text;
      // 不重新渲染，避免光标跳转
      updateDiffStatsOnly();
    } catch (e) {}
  }, 500);
});

/**
 * 只更新统计，不重新渲染
 */
function updateDiffStatsOnly() {
  const diffs = collectDiffs(diffDataA, diffDataB);
  const stats = { add: diffs.add.size, del: diffs.del.size, mod: diffs.mod.size };
  const diffStatsEl = document.getElementById('diffStats');
  if (diffStatsEl) {
    const total = stats.add + stats.del + stats.mod;
    if (total > 0) {
      diffStatsEl.innerHTML = `<span class="diff-count-add">+${stats.add} added</span> <span class="diff-count-del">-${stats.del} removed</span> <span class="diff-count-mod">~${stats.mod} changed</span>`;
    } else {
      diffStatsEl.innerHTML = '';
    }
  }
}

// 监听 blur 事件（编辑完成时）
diffOutputA.addEventListener('blur', () => {
  // 尝试从 innerText 解析，先清理
  const text = cleanJsonText(diffOutputA.innerText);
  console.log('blur A cleaned text:', text);
  try {
    diffDataA = JSON.parse(text);
    diffRawA = text;
    renderDiff();
  } catch (e) {
    console.log('blur A parse error:', e.message);
  }
});

diffOutputB.addEventListener('blur', () => {
  const text = cleanJsonText(diffOutputB.innerText);
  console.log('blur B cleaned text:', text);
  try {
    diffDataB = JSON.parse(text);
    diffRawB = text;
    renderDiff();
  } catch (e) {
    console.log('blur B parse error:', e.message);
  }
});

// 对比按钮
const compareBtn = document.getElementById('compareBtn');
compareBtn.onclick = () => {
  // 从两侧提取 JSON
  const textA = cleanJsonText(diffOutputA.innerText);
  const textB = cleanJsonText(diffOutputB.innerText);

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

// ===================== JSON 转换功能 =====================

/**
 * 将 JSON 转换为 TypeScript 接口
 * @param {object} data - JSON 对象
 * @param {string} interfaceName - 接口名称
 * @param {number} indent - 缩进级别
 * @returns {string} TypeScript 接口定义
 */
function jsonToTypeScript(data, interfaceName = 'Root', indent = 0) {
  const pad = '  '.repeat(indent);

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
      let result = jsonToTypeScript(firstItem, itemType, indent);
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
      result += `${pad}  ${key}${optional}: ${tsType};\n`;
    }
    result += `${pad}}\n`;

    // 为嵌套对象生成类型
    for (const key of keys) {
      const value = data[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result += jsonToTypeScript(value, `${interfaceName}_${capitalize(key)}`, indent);
      }
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        result += jsonToTypeScript(value[0], `${interfaceName}_${capitalize(key)}Item`, indent);
      }
    }

    return result;
  }

  return `${pad}type ${interfaceName} = ${getTsType(data)};\n`;
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
 * 将 JSON 转换为 Go struct
 * @param {object} data - JSON 对象
 * @param {string} structName - 结构体名称
 * @param {number} indent - 缩进级别
 * @param {Set} generatedStructs - 已生成的结构体（避免重复）
 * @returns {string} Go struct 定义
 */
function jsonToGo(data, structName = 'Root', indent = 0, generatedStructs = new Set()) {
  const pad = '\t'.repeat(indent);

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
      let result = jsonToGo(firstItem, itemName, indent, generatedStructs);
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
    const jsonTag = key;
    const fieldName = capitalize(key);
    result += `${pad}\t${fieldName} ${goType} \`json:"${jsonTag}"\`\n`;
  }
  result += `${pad}}\n\n`;

  // 为嵌套对象生成结构体
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result += jsonToGo(value, `${structName}${capitalize(key)}`, indent, generatedStructs);
    }
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
      result += jsonToGo(value[0], `${structName}${capitalize(key)}Item`, indent, generatedStructs);
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
 * 将 JSON 转换为 YAML
 * @param {object} data - JSON 对象
 * @param {number} indent - 缩进级别
 * @returns {string} YAML 字符串
 */
function jsonToYaml(data, indent = 0) {
  const pad = '  '.repeat(indent);

  if (data === null) {
    return 'null';
  }

  if (typeof data === 'string') {
    // 如果包含特殊字符，用引号包裹
    if (data.includes(':') || data.includes('#') || data.includes('\n') || data.includes('"')) {
      return `"${data.replace(/"/g, '\\"')}"`;
    }
    return data;
  }

  if (typeof data === 'number') {
    return String(data);
  }

  if (typeof data === 'boolean') {
    return data ? 'true' : 'false';
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '[]';
    }
    return data.map(item => {
      const value = jsonToYaml(item, indent + 1);
      if (typeof item === 'object' && item !== null) {
        return `- \n${value.split('\n').map(line => '  ' + line).join('\n')}`;
      }
      return `- ${value}`;
    }).join('\n' + pad);
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return '{}';
    }

    return keys.map(key => {
      const value = data[key];
      const yamlValue = jsonToYaml(value, indent + 1);

      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value) && value.length > 0) {
          return `${key}:\n${yamlValue.split('\n').map(line => '  ' + line).join('\n')}`;
        } else if (!Array.isArray(value)) {
          return `${key}:\n${yamlValue.split('\n').map(line => '  ' + line).join('\n')}`;
        }
      }

      return `${key}: ${yamlValue}`;
    }).join('\n' + pad);
  }

  return String(data);
}

/**
 * 执行转换
 */
function doConvert() {
  const text = convertInput.value.trim();
  if (!text) {
    convertResult.textContent = '';
    return;
  }

  try {
    const data = JSON.parse(text);
    let result = '';

    switch (currentConvertType) {
      case 'typescript':
        result = jsonToTypeScript(data);
        break;
      case 'go':
        result = jsonToGo(data);
        break;
      case 'yaml':
        result = jsonToYaml(data);
        break;
    }

    convertResult.textContent = result;
    convertResult.style.color = 'var(--text)';
  } catch (e) {
    convertResult.textContent = `解析失败: ${e.message}`;
    convertResult.style.color = '#f48771';
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

// 输入框事件
convertInput.addEventListener('input', () => {
  clearTimeout(convertInput._timer);
  convertInput._timer = setTimeout(doConvert, 300);
});

// 清空
clearConvertBtn.onclick = () => {
  convertInput.value = '';
  convertResult.textContent = '';
};

// 复制
copyConvertBtn.onclick = async () => {
  const text = convertResult.textContent;
  if (text) {
    await navigator.clipboard.writeText(text);
    showToast();
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
        if (typeof result === 'object' && !Array.isArray(result) && token.value in result) {
          newResults.push(result[token.value]);
        }
      } else if (token.type === 'index') {
        // 数组索引
        if (Array.isArray(result)) {
          if (token.value === '*') {
            // [*] 所有元素
            newResults.push(...result);
          } else if (typeof token.value === 'number') {
            if (token.value >= 0 && token.value < result.length) {
              newResults.push(result[token.value]);
            } else if (token.value < 0 && Math.abs(token.value) <= result.length) {
              // 负索引
              newResults.push(result[result.length + token.value]);
            }
          } else if (Array.isArray(token.value)) {
            // 多个索引 [a,b,c]
            for (const idx of token.value) {
              if (idx >= 0 && idx < result.length) {
                newResults.push(result[idx]);
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
 * 解析路径为 token 数组
 */
function tokenize(path) {
  const tokens = [];
  let i = 0;

  // 跳过 $
  if (path[0] === '$') i = 1;

  while (i < path.length) {
    if (path[i] === '.') {
      if (path[i + 1] === '.') {
        // 递归下降 ..
        i += 2;
        let key = '';
        while (i < path.length && path[i] !== '.' && path[i] !== '[') {
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
          while (i < path.length && path[i] !== '.' && path[i] !== '[') {
            key += path[i];
            i++;
          }
          if (key) tokens.push({ type: 'key', value: key });
        }
      }
    } else if (path[i] === '[') {
      i++;
      let content = '';
      while (i < path.length && path[i] !== ']') {
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
 * 递归查找所有匹配的 key
 */
function findRecursive(obj, key, results) {
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      findRecursive(item, key, results);
    }
  } else if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (k === key) {
        results.push(v);
      }
      findRecursive(v, key, results);
    }
  }
}

/**
 * 收集所有值
 */
function collectAll(obj, results) {
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(item);
      collectAll(item, results);
    }
  } else if (typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      results.push(v);
      collectAll(v, results);
    }
  }
}

/**
 * 执行 JSON Path 查询
 */
function queryPath() {
  const text = pathInput.value.trim();
  const expr = pathExpr.value.trim();

  if (!text) {
    pathResult.innerHTML = '<div class="error">请输入 JSON</div>';
    return;
  }

  if (!expr) {
    pathResult.innerHTML = '<div class="error">请输入 JSON Path 表达式</div>';
    return;
  }

  try {
    pathData = JSON.parse(text);
  } catch (e) {
    pathResult.innerHTML = `<div class="error">JSON 解析失败: ${e.message}</div>`;
    return;
  }

  try {
    const results = jsonPath(pathData, expr);

    if (results.length === 0) {
      pathResult.innerHTML = '<div class="error">未找到匹配结果</div>';
      return;
    }

    // 渲染结果
    let html = `<div style="color: #6a9955; margin-bottom: 8px;">找到 ${results.length} 个结果:</div>`;
    results.forEach((r, i) => {
      html += `<div style="margin-bottom: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">`;
      html += `<div style="color: #888; font-size: 11px; margin-bottom: 4px;">[${i}]</div>`;
      html += render(r);
      html += `</div>`;
    });
    pathResult.innerHTML = html;
  } catch (e) {
    pathResult.innerHTML = `<div class="error">查询失败: ${e.message}</div>`;
  }
}

// Path 输入框事件
pathInput.addEventListener('input', () => {
  clearTimeout(pathInput._timer);
  pathInput._timer = setTimeout(queryPath, 500);
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

/**
 * JSON 压缩（去除空格换行）
 */
function compactJson() {
  const text = compactInput.value.trim();
  if (!text) {
    compactOutput.value = '';
    return;
  }

  try {
    const obj = JSON.parse(text);
    compactOutput.value = JSON.stringify(obj);
  } catch (e) {
    // 可能已经是压缩格式，尝试直接输出
    compactOutput.value = `解析失败: ${e.message}`;
  }
}

/**
 * JSON 转义（转为字符串）
 */
function escapeJson() {
  const text = compactInput.value.trim();
  if (!text) {
    compactOutput.value = '';
    return;
  }

  try {
    // 先验证是否为有效 JSON
    const obj = JSON.parse(text);
    // 转义：将 JSON 字符串化后再转义引号
    const jsonStr = JSON.stringify(obj);
    // 转义特殊字符
    compactOutput.value = jsonStr
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  } catch (e) {
    compactOutput.value = `解析失败: ${e.message}`;
  }
}

/**
 * JSON 反转义（从字符串还原）
 */
function unescapeJson() {
  const text = compactInput.value.trim();
  if (!text) {
    compactOutput.value = '';
    return;
  }

  try {
    // 反转义特殊字符
    let unescaped = text
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    // 尝试解析并格式化
    const obj = JSON.parse(unescaped);
    compactOutput.value = JSON.stringify(obj, null, 2);
  } catch (e) {
    compactOutput.value = `反转义失败: ${e.message}`;
  }
}

compactBtn.onclick = compactJson;
escapeBtn.onclick = escapeJson;
unescapeBtn.onclick = unescapeJson;

clearCompactBtn.onclick = () => {
  compactInput.value = '';
  compactOutput.value = '';
};

copyCompactBtn.onclick = async () => {
  const text = compactOutput.value;
  if (text && !text.startsWith('解析失败') && !text.startsWith('反转义失败')) {
    await navigator.clipboard.writeText(text);
    showToast();
  }
};
