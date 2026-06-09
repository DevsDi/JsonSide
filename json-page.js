/**
 * JSON Side - JSON Page Formatter
 * Automatically format JSON content when viewing raw JSON in browser
 */

(function () {
  'use strict';

  // Maximum input size (1MB)
  const MAX_INPUT_SIZE = 1024 * 1024;

  // Maximum nesting depth
  const MAX_DEPTH = 50;

  // ID counter max (prevent overflow)
  const MAX_ID_COUNTER = 10000000;

  // Timestamp range (2000-2100)
  const TS_MIN_SEC = 946684800;
  const TS_MAX_SEC = 4102444800;

  let idCounter = 0;

  /**
   * Check if page content is likely JSON
   * @returns {boolean}
   */
  function isJsonPage() {
    // Check Content-Type header via meta tag or document type
    const contentType = document.contentType || '';
    if (contentType.includes('application/json') || contentType.includes('text/json')) {
      return true;
    }

    // Check if body contains only JSON-like content
    const bodyText = document.body.innerText || document.body.textContent || '';
    const trimmed = bodyText.trim();

    // Empty or too short
    if (trimmed.length < 2) return false;

    // Check if starts with JSON structural characters
    const firstChar = trimmed[0];
    const lastChar = trimmed[trimmed.length - 1];
    if ((firstChar === '{' && lastChar === '}') ||
        (firstChar === '[' && lastChar === ']')) {
      // Try to parse
      try {
        JSON.parse(trimmed);
        return true;
      } catch (e) {
        return false;
      }
    }

    return false;
  }

  /**
   * HTML escape (prevent XSS)
   */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Format timestamp
   */
  function formatTs(ts) {
    const ms = ts > 1000000000000 ? ts : ts * 1000;
    const date = new Date(ms);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const sec = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${sec}`;
  }

  /**
   * Render JSON with syntax highlighting
   */
  function render(data, depth = 0) {
    if (depth > MAX_DEPTH) {
      return '<span class="jp-error">Nested too deep, truncated</span>';
    }

    if (data === null) return '<span class="jp-null">null</span>';
    if (typeof data === 'string') return `<span class="jp-string">"${esc(data)}"</span>`;
    if (typeof data === 'number') {
      // Check if timestamp
      let isTs = false;
      if (data > TS_MIN_SEC && data < TS_MAX_SEC) {
        isTs = true;
      } else if (data > TS_MIN_SEC * 1000 && data < TS_MAX_SEC * 1000) {
        isTs = true;
      }
      if (isTs) {
        return `<span class="jp-number jp-ts" data-ts="${data}" title="${formatTs(data)}">${data}</span>`;
      }
      return `<span class="jp-number">${data}</span>`;
    }
    if (typeof data === 'boolean') return `<span class="jp-bool">${data}</span>`;

    if (Array.isArray(data)) {
      if (data.length === 0) return '<span class="jp-bracket">[]</span>';
      if (idCounter > MAX_ID_COUNTER) idCounter = 0;
      const id = 'jp' + (idCounter++);
      const items = data.map((v, i) => {
        const val = render(v, depth + 1);
        const comma = i < data.length - 1 ? '<span class="jp-comma">,</span>' : '';
        return `<div class="jp-line">${val}${comma}</div>`;
      }).join('');
      return `<span class="jp-toggle" data-id="${id}">▼</span><span class="jp-bracket">[</span><span class="jp-count">${data.length}</span><div class="jp-block" id="${id}">${items}</div><span class="jp-bracket">]</span>`;
    }

    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return '<span class="jp-bracket">{}</span>';
      if (idCounter > MAX_ID_COUNTER) idCounter = 0;
      const id = 'jp' + (idCounter++);
      const items = keys.map((k, i) => {
        const val = render(data[k], depth + 1);
        const comma = i < keys.length - 1 ? '<span class="jp-comma">,</span>' : '';
        return `<div class="jp-line"><span class="jp-key">"${esc(k)}"</span>: ${val}${comma}</div>`;
      }).join('');
      return `<span class="jp-toggle" data-id="${id}">▼</span><span class="jp-bracket">{</span><span class="jp-count">${keys.length}</span><div class="jp-block" id="${id}">${items}</div><span class="jp-bracket">}</span>`;
    }

    return String(data);
  }

  /**
   * Inject CSS styles
   */
  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'json-page-styles';
    style.textContent = `
      /* Container */
      #json-page-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #1e1e1e;
        color: #d4d4d4;
        font-family: Consolas, 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.5;
        padding: 60px 20px 20px 20px;
        overflow: auto;
        z-index: 2147483647;
      }

      /* Toolbar */
      #json-page-toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 40px;
        background: #252526;
        border-bottom: 1px solid #3c3c3c;
        display: flex;
        align-items: center;
        padding: 0 16px;
        z-index: 2147483647;
        gap: 12px;
      }

      #json-page-toolbar .jp-title {
        color: #569cd6;
        font-weight: 600;
        font-size: 14px;
      }

      #json-page-toolbar .jp-btn {
        background: #0e639c;
        color: #fff;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.2s;
      }

      #json-page-toolbar .jp-btn:hover {
        background: #1177bb;
      }

      #json-page-toolbar .jp-btn.active {
        background: #4caf50;
      }

      #json-page-toolbar .jp-info {
        color: #888;
        font-size: 12px;
        margin-left: auto;
      }

      /* Output */
      #json-page-output {
        white-space: pre-wrap;
        word-break: break-word;
      }

      /* Syntax highlighting */
      .jp-key { color: #9cdcfe; }
      .jp-string { color: #ce9178; }
      .jp-number { color: #b5cea8; }
      .jp-bool { color: #569cd6; }
      .jp-null { color: #569cd6; }
      .jp-bracket { color: #ffd700; }
      .jp-comma { color: #d4d4d4; }
      .jp-count { color: #888; margin-left: 4px; font-size: 11px; }
      .jp-error { color: #f48771; }
      .jp-ts { cursor: pointer; border-bottom: 1px dashed #888; }

      /* Structure */
      .jp-line { padding-left: 16px; }
      .jp-block { padding-left: 0; }
      .jp-block.hide { display: none; }
      .jp-toggle {
        cursor: pointer;
        color: #888;
        font-size: 10px;
        margin-right: 4px;
        user-select: none;
      }
      .jp-toggle:hover { color: #fff; }

      /* Raw view */
      #json-page-raw {
        white-space: pre-wrap;
        word-break: break-word;
        display: none;
      }

      /* Toggle timestamp formatted */
      .jp-ts.formatted { color: #4ec9b0; }

      /* Copy button */
      #json-page-toolbar .jp-copy {
        background: #333;
      }
      #json-page-toolbar .jp-copy:hover {
        background: #444;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create toolbar
   */
  function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'json-page-toolbar';
    toolbar.innerHTML = `
      <span class="jp-title">JSON Side</span>
      <button class="jp-btn active" id="jp-btn-format">Formatted</button>
      <button class="jp-btn" id="jp-btn-raw">Raw</button>
      <button class="jp-btn jp-copy" id="jp-btn-copy">Copy</button>
      <span class="jp-info" id="jp-info"></span>
    `;
    return toolbar;
  }

  /**
   * Bind toggle events
   */
  function bindToggleEvents(container) {
    container.querySelectorAll('.jp-toggle').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.id;
        if (id) {
          const block = document.getElementById(id);
          if (block) {
            const hide = block.classList.toggle('hide');
            el.textContent = hide ? '▶' : '▼';
          }
        }
      };
    });

    // Timestamp click to show formatted
    container.querySelectorAll('.jp-ts').forEach(el => {
      el.onclick = () => {
        const ts = el.dataset.ts;
        if (ts) {
          const isFmt = el.classList.toggle('formatted');
          el.textContent = isFmt ? formatTs(Number(ts)) : ts;
        }
      };
    });
  }

  /**
   * Format and display JSON
   */
  function formatJson(jsonText) {
    const container = document.createElement('div');
    container.id = 'json-page-container';

    const toolbar = createToolbar();
    container.appendChild(toolbar);

    const output = document.createElement('div');
    output.id = 'json-page-output';
    container.appendChild(output);

    const rawOutput = document.createElement('div');
    rawOutput.id = 'json-page-raw';
    rawOutput.textContent = jsonText;
    container.appendChild(rawOutput);

    // Hide original body
    document.body.style.display = 'none';

    // Append container
    document.documentElement.appendChild(container);

    // Parse and render
    idCounter = 0;
    let parsedObj = null;
    let parseSuccess = false;

    try {
      parsedObj = JSON.parse(jsonText);
      parseSuccess = true;
      output.innerHTML = render(parsedObj);
      bindToggleEvents(output);

      // Update info
      const info = document.getElementById('jp-info');
      const sizeKB = (jsonText.length / 1024).toFixed(1);
      info.textContent = `${sizeKB} KB`;

    } catch (e) {
      output.innerHTML = `<span class="jp-error">Parse failed: ${esc(e.message)}</span>`;
    }

    // Current view state
    let currentView = 'formatted';

    // Button events
    const formatBtn = document.getElementById('jp-btn-format');
    const rawBtn = document.getElementById('jp-btn-raw');
    const copyBtn = document.getElementById('jp-btn-copy');

    formatBtn.onclick = () => {
      currentView = 'formatted';
      formatBtn.classList.add('active');
      rawBtn.classList.remove('active');
      output.style.display = 'block';
      rawOutput.style.display = 'none';
    };

    rawBtn.onclick = () => {
      currentView = 'raw';
      rawBtn.classList.add('active');
      formatBtn.classList.remove('active');
      rawOutput.style.display = 'block';
      output.style.display = 'none';
    };

    copyBtn.onclick = async () => {
      try {
        let textToCopy;
        if (currentView === 'formatted' && parseSuccess && parsedObj) {
          // Copy formatted JSON
          textToCopy = JSON.stringify(parsedObj, null, 2);
        } else {
          // Copy raw JSON
          textToCopy = jsonText;
        }
        await navigator.clipboard.writeText(textToCopy);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 2000);
      } catch (e) {
        copyBtn.textContent = 'Failed';
        setTimeout(() => copyBtn.textContent = 'Copy', 2000);
      }
    };
  }

  /**
   * Initialize
   */
  function init() {
    // Skip if already formatted
    if (document.getElementById('json-page-container')) return;

    // Check if JSON page
    if (!isJsonPage()) return;

    // Get JSON content
    const jsonText = (document.body.innerText || document.body.textContent || '').trim();

    // Size limit
    if (jsonText.length > MAX_INPUT_SIZE) return;

    // Inject styles
    injectStyles();

    // Format JSON
    formatJson(jsonText);
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();