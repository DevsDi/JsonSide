/**
 * JSON Side - Content Script
 * 页面内时间戳悬停格式化
 */

(function () {
  'use strict';

  // 创建提示元素
  let tooltip = null;

  function createTooltip() {
    if (tooltip) return;
    tooltip = document.createElement('div');
    tooltip.id = 'json-side-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      background: #1e1e2e;
      color: #fab387;
      padding: 4px 8px;
      border-radius: 8px;
      font-size: 12px;
      font-family: Consolas, monospace;
      border: 1px solid #313244;
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
   * 检测是否为时间戳（严格范围：2000-2100年）
   */
  function isTimestamp(str) {
    const num = parseInt(str, 10);
    if (isNaN(num)) return false;

    // 时间戳合理范围（2000-01-01 到 2100-01-01）
    const TS_MIN_SEC = 946684800;     // 2000-01-01 00:00:00 UTC (秒)
    const TS_MAX_SEC = 4102444800;    // 2100-01-01 00:00:00 UTC (秒)

    // 秒级时间戳
    if (num > TS_MIN_SEC && num < TS_MAX_SEC) return true;
    // 毫秒级时间戳
    if (num > TS_MIN_SEC * 1000 && num < TS_MAX_SEC * 1000) return true;

    return false;
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
   * 显示提示（fixed 定位直接用视口坐标）
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

  // 当前悬停的元素和对应的时间戳
  let hoverTimer = null;
  let currentHoverEl = null;
  let currentTz = 8;

  // 初始化时区
  getTimezone().then(tz => currentTz = tz);

  // 监听时区变化
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.tzOffset) {
      currentTz = Number(changes.tzOffset.newValue);
    }
  });

  /**
   * 处理悬停逻辑
   * 使用 mousemove 替代 mouseover，避免子元素间切换时 mouseout 误清除定时器
   * 同一元素及子元素内移动不重复处理
   */
  document.addEventListener('mousemove', (e) => {
    const el = e.target;

    // 检查元素类型
    const tagName = el.tagName?.toLowerCase();
    if (!tagName) return;

    // 排除不需要处理的元素
    if (['input', 'textarea', 'select', 'option'].includes(tagName)) return;

    // 如果鼠标仍在当前悬停元素或其子元素内，不重复处理
    if (currentHoverEl && currentHoverEl.contains(el)) return;

    // 切换了元素，清除之前的定时器
    clearTimeout(hoverTimer);
    currentHoverEl = el;

    // 检查是否包含时间戳
    const ts = extractTimestamp(el);
    if (ts === null) {
      hideTooltip();
      currentHoverEl = null;
      return;
    }

    // 延迟显示，避免鼠标快速划过时频繁弹出
    hoverTimer = setTimeout(() => {
      const formatted = formatTimestamp(ts, currentTz);
      // fixed 定位直接使用 getBoundingClientRect 的视口坐标，不加 scrollX/scrollY
      const rect = el.getBoundingClientRect();
      showTooltip(rect.left, rect.bottom, formatted);
    }, 300);
  });

  // 鼠标离开文档时隐藏
  document.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
    hideTooltip();
    currentHoverEl = null;
  }, true);

  // 滚动时隐藏
  document.addEventListener('scroll', () => {
    hideTooltip();
  }, true);

})();
