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

function switchMode(mode) {
  if (mode === 'format') {
    modeFormatBtn.classList.add('active');
    modeDiffBtn.classList.remove('active');
    formatMode.style.display = 'grid';
    diffMode.style.display = 'none';
    // 显示格式化模式的按钮
    document.getElementById('tzSelect').style.display = '';
    document.getElementById('formatBtn').style.display = '';
    document.getElementById('formatTsBtn').style.display = '';
    document.getElementById('expandBtn').style.display = '';
    document.getElementById('collapseBtn').style.display = '';
    document.getElementById('copyBtn').style.display = '';
    document.getElementById('clearBtn').style.display = '';
  } else {
    modeFormatBtn.classList.remove('active');
    modeDiffBtn.classList.add('active');
    formatMode.style.display = 'none';
    diffMode.style.display = 'grid';
    // 隐藏格式化模式的按钮
    document.getElementById('tzSelect').style.display = 'none';
    document.getElementById('formatBtn').style.display = 'none';
    document.getElementById('formatTsBtn').style.display = 'none';
    document.getElementById('expandBtn').style.display = 'none';
    document.getElementById('collapseBtn').style.display = 'none';
    document.getElementById('copyBtn').style.display = 'none';
    document.getElementById('clearBtn').style.display = 'none';
  }
}

modeFormatBtn.onclick = () => switchMode('format');
modeDiffBtn.onclick = () => switchMode('diff');

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
