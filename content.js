/**
 * JSON Formatter - Content Script
 * 页面内时间戳悬停格式化
 */

(function () {
  'use strict';

  // 创建提示元素
  let tooltip = null;

  function createTooltip() {
    if (tooltip) return;
    tooltip = document.createElement('div');
    tooltip.id = 'json-fmt-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      background: #1e1e1e;
      color: #ce9178;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: Consolas, monospace;
      border: 1px solid #3c3c3c;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      pointer-events: none;
      display: none;
    `;
    document.body.appendChild(tooltip);
  }

  /**
   * 格式化时间戳
   */
  function formatTimestamp(ts, tzOffset) {
    const ms = ts > 1000000000000 ? ts : ts * 1000;
    const date = new Date(ms + tzOffset * 3600000);

    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    const min = String(date.getUTCMinutes()).padStart(2, '0');
    const sec = String(date.getUTCSeconds()).padStart(2, '0');

    return `${y}-${m}-${d} ${h}:${min}:${sec}`;
  }

  /**
   * 检测是否为时间戳
   */
  function isTimestamp(str) {
    const num = parseInt(str, 10);
    if (isNaN(num)) return false;
    // 10位秒级 或 13位毫秒级
    return (num > 1000000000 && num < 100000000000) ||
           (num > 1000000000000 && num < 10000000000000);
  }

  /**
   * 从元素中提取时间戳
   */
  function extractTimestamp(el) {
    const text = el.textContent || el.innerText || '';
    // 匹配纯数字或数字串
    const match = text.match(/\b(\d{10,13})\b/);
    if (match && isTimestamp(match[1])) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  /**
   * 获取保存的时区设置
   */
  async function getTimezone() {
    try {
      const result = await chrome.storage.local.get('tzOffset');
      return result.tzOffset !== undefined ? Number(result.tzOffset) : 8;
    } catch {
      return 8;
    }
  }

  /**
   * 显示提示
   */
  function showTooltip(x, y, text) {
    if (!tooltip) createTooltip();
    tooltip.textContent = text;
    tooltip.style.left = x + 10 + 'px';
    tooltip.style.top = y + 10 + 'px';
    tooltip.style.display = 'block';
  }

  /**
   * 隐藏提示
   */
  function hideTooltip() {
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  // 防抖
  let hoverTimer = null;
  let currentTz = 8;

  // 初始化时区
  getTimezone().then(tz => currentTz = tz);

  // 监听时区变化
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.tzOffset) {
      currentTz = Number(changes.tzOffset.newValue);
    }
  });

  // 监听鼠标悬停
  document.addEventListener('mouseover', (e) => {
    clearTimeout(hoverTimer);

    const el = e.target;

    // 检查元素类型
    const tagName = el.tagName?.toLowerCase();
    if (!tagName) return;

    // 排除不需要处理的元素
    if (['input', 'textarea', 'select', 'option'].includes(tagName)) return;

    // 检查是否包含时间戳
    const ts = extractTimestamp(el);
    if (ts === null) {
      hideTooltip();
      return;
    }

    // 延迟显示，避免鼠标快速划过时频繁弹出
    hoverTimer = setTimeout(() => {
      const formatted = formatTimestamp(ts, currentTz);
      const rect = el.getBoundingClientRect();
      showTooltip(rect.left + window.scrollX, rect.bottom + window.scrollY, formatted);
    }, 300);
  });

  // 鼠标移出时隐藏
  document.addEventListener('mouseout', (e) => {
    clearTimeout(hoverTimer);
    // 检查是否移到提示框上
    if (e.relatedTarget?.id === 'json-fmt-tooltip') return;
    hideTooltip();
  });

  // 滚动时隐藏
  document.addEventListener('scroll', () => {
    hideTooltip();
  }, true);

})();
