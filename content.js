/**
 * JSON Side - Content Script
 * 页面内时间戳划词格式化（选中文本后自动弹出）
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
    // 输入校验：ts/tzOffset 必须为有限数字，否则返回占位符
    if (!Number.isFinite(ts) || !Number.isFinite(tzOffset)) return '--';
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
   * 仅接受 10-13 位纯数字字符串
   */
  function isTimestamp(str) {
    if (typeof str !== 'string') return false;
    // 格式校验：必须是 10-13 位纯数字，避免子串/混合文本误触发
    if (!/^\d{10,13}$/.test(str)) return false;

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
   * 获取保存的时区设置
   */
  async function getTimezone() {
    // chrome.storage 在部分页面上下文中可能不可用，需判空并兜底
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return 8;
    try {
      const result = await chrome.storage.local.get('tzOffset');
      const tz = Number(result.tzOffset);
      return Number.isFinite(tz) ? tz : 8;
    } catch {
      return 8;
    }
  }

  /**
   * 显示提示（fixed 定位直接用视口坐标，含边界检测防止溢出屏幕）
   */
  function showTooltip(x, y, text) {
    if (!tooltip) createTooltip();
    tooltip.textContent = text;
    // 先隐藏但渲染，以获取 tooltip 尺寸，避免闪烁
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';

    const tooltipRect = tooltip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 15;

    // 防止 x/y 为负值（元素可能在视口外）
    x = Math.max(0, x);
    y = Math.max(0, y);

    // 水平边界：如果右侧超出视口，向左偏移
    let left = x + GAP;
    if (left + tooltipRect.width > vw) {
      left = x - tooltipRect.width - GAP;
    }
    // 如果左侧也超出视口，贴紧左边界
    if (left < 0) {
      left = 4;
    }

    // 垂直边界：如果底部超出视口，向上偏移
    let top = y + GAP;
    if (top + tooltipRect.height > vh) {
      top = y - tooltipRect.height - GAP;
    }
    // 如果顶部也超出视口，贴紧顶部
    if (top < 0) {
      top = 4;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.style.visibility = 'visible';
  }

  /**
   * 隐藏提示
   */
  function hideTooltip() {
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  // 当前时区偏移（小时）
  let currentTz = 8;

  // 初始化时区
  getTimezone().then(tz => currentTz = tz);

  // 监听时区变化
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.tzOffset) {
        const tz = Number(changes.tzOffset.newValue);
        if (Number.isFinite(tz)) currentTz = tz;
      }
    });
  }

  /**
   * 处理选区变化
   * 选中文本整体为时间戳时，在选区下方自动弹出格式化结果；其余情况隐藏
   */
  function handleSelection() {
    try {
      const sel = window.getSelection();
      // 空指针防护：选区不存在或无选区内容
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        hideTooltip();
        return;
      }

      const text = sel.toString().trim();
      if (!text) {
        hideTooltip();
        return;
      }

      // 整体匹配时间戳，不做子串提取
      if (!isTimestamp(text)) {
        hideTooltip();
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      // 选区在视口外（如跨行包围盒为 0 尺寸）时不显示
      if (rect.width === 0 && rect.height === 0) {
        hideTooltip();
        return;
      }

      const ts = parseInt(text, 10);
      const formatted = formatTimestamp(ts, currentTz);
      showTooltip(rect.left, rect.bottom, formatted);
    } catch {
      // selection API 在部分场景下会抛错，静默隐藏并退出
      hideTooltip();
    }
  }

  /**
   * 划词完成（mouseup）后触发
   * 延迟一帧等待浏览器更新选区，避免取到上一次的旧选区
   */
  document.addEventListener('mouseup', () => {
    setTimeout(handleSelection, 0);
  });

  // 选区变化（键盘 Shift+方向键 / 全选等）时同步更新
  document.addEventListener('selectionchange', () => {
    handleSelection();
  });

  // 点击页面时若选区已被清除则隐藏（点击本身不清除选区时不干预）
  document.addEventListener('mousedown', () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      hideTooltip();
    }
  }, true);

  // 按 Esc 取消选区时隐藏
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideTooltip();
    }
  }, true);

  // 滚动时隐藏
  document.addEventListener('scroll', () => {
    hideTooltip();
  }, { capture: true, passive: true });

})();
