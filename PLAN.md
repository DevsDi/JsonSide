# Diff 付费 + 历史功能实现计划

## 目标
实现 Diff 功能买断付费（$9 早鸟价）+ 历史记录扩容，验证市场付费意愿。

---

## 💰 定价

| 阶段 | 价格 | 条件 |
|------|------|------|
| **早鸟价** | **$9** | 前 50 名 |
| 正式价 | $15 | 早鸟结束后 |

**定价理由**：
- 浏览器插件用户心理价位 $5-15
- $9 不到一杯咖啡，决策成本低
- 快速验证市场付费意愿

---

## 产品设计

### 免费版限制
```
Diff:
├── 每日 3 次
├── 单次最大 10KB
└── 无导出功能

历史记录:
└── 本地存储 50 条
```

### Pro 版权益（$9 买断）
```
Diff:
├── 无限次数
├── 单次最大 10MB
└── 导出 HTML 报告

历史记录:
└── 本地存储 1000 条
```

---

## 文件修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `popup.js` | 修改 | 添加付费限制逻辑 |
| `popup.html` | 修改 | 添加升级弹窗 UI + CSS |
| `license.html` | 新建 | 激活码输入页面 |
| `license.js` | 新建 | 激活验证逻辑 |

---

## 实现步骤

### Step 1: 付费限制逻辑（popup.js）

```javascript
// ========== 付费限制配置 ==========
const FREE_DIFF_LIMIT = 3;              // 每日免费次数
const FREE_DIFF_SIZE = 10 * 1024;       // 免费版最大 10KB
const PRO_DIFF_SIZE = 10 * 1024 * 1024; // Pro 版最大 10MB

// 检查是否为 Pro 用户
async function isProUser() {
  const result = await chrome.storage.local.get('licenseKey');
  return !!result.licenseKey;
}

// 获取今日 Diff 使用次数
async function getTodayDiffUsage() {
  const result = await chrome.storage.local.get(['diffUsageDate', 'diffUsageCount']);
  const today = new Date().toDateString();
  
  if (result.diffUsageDate !== today) {
    await chrome.storage.local.set({ diffUsageDate: today, diffUsageCount: 0 });
    return 0;
  }
  return result.diffUsageCount || 0;
}

// 检查是否可以使用 Diff
async function canUseDiff(inputSize) {
  if (await isProUser()) return { allowed: true, isPro: true };
  
  // 检查文件大小
  if (inputSize > FREE_DIFF_SIZE) {
    return { 
      allowed: false, 
      reason: 'size_limit',
      message: `免费版最大 10KB，当前 ${(inputSize/1024).toFixed(1)}KB`
    };
  }
  
  // 检查次数
  const usage = await getTodayDiffUsage();
  if (usage >= FREE_DIFF_LIMIT) {
    return { 
      allowed: false, 
      reason: 'count_limit',
      message: `今日已使用 ${usage} 次`
    };
  }
  
  return { allowed: true, usage, isPro: false };
}

// 记录 Diff 使用
async function recordDiffUsage() {
  if (await isProUser()) return;
  const usage = await getTodayDiffUsage();
  await chrome.storage.local.set({ diffUsageCount: usage + 1 });
}
```

### Step 2: 修改 compareBtn.onclick

```javascript
// 原代码修改为：
compareBtn.onclick = async () => {
  const textA = cleanJsonText(diffOutputA.innerText);
  const textB = cleanJsonText(diffOutputB.innerText);
  const inputSize = textA.length + textB.length;

  // 检查付费限制
  const check = await canUseDiff(inputSize);
  if (!check.allowed) {
    showUpgradeDialog(check);
    return;
  }

  // 原有逻辑...
  
  // 记录使用次数
  await recordDiffUsage();
  
  // 显示剩余次数（免费用户）
  if (!check.isPro) {
    updateDiffUsageDisplay(check.usage + 1);
  }
};
```

### Step 3: 升级弹窗 UI（添加到 popup.html）

```html
<!-- 升级弹窗 -->
<div id="upgradeOverlay" class="upgrade-overlay" style="display:none;">
  <div class="upgrade-dialog">
    <div class="upgrade-header">
      <span class="upgrade-icon">⭐</span>
      <h2>升级 Diff Pro</h2>
    </div>
    <p id="upgradeReason" class="upgrade-reason"></p>
    <div class="upgrade-features">
      <div class="feature-item">✓ 无限 Diff 对比</div>
      <div class="feature-item">✓ 单次最大 10MB</div>
      <div class="feature-item">✓ 导出 HTML 报告</div>
      <div class="feature-item">✓ 历史记录 1000 条</div>
    </div>
    <div class="upgrade-price-box">
      <span class="upgrade-price">$19</span>
      <span class="upgrade-price-note">终身使用</span>
    </div>
    <div class="upgrade-buttons">
      <button id="buyNowBtn" class="btn-primary">立即购买</button>
      <button id="enterKeyBtn" class="btn-secondary">输入激活码</button>
    </div>
    <button id="closeUpgradeBtn" class="upgrade-close">×</button>
  </div>
</div>
```

### Step 4: 升级弹窗 CSS（添加到 popup.html style）

```css
/* 升级弹窗样式 */
.upgrade-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.upgrade-dialog {
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 12px;
  padding: 24px;
  max-width: 360px;
  position: relative;
}
.upgrade-header {
  text-align: center;
  margin-bottom: 16px;
}
.upgrade-icon { font-size: 32px; }
.upgrade-header h2 { margin: 8px 0 0; font-size: 20px; }
.upgrade-reason {
  text-align: center;
  color: #f48771;
  margin-bottom: 16px;
}
.upgrade-features {
  margin-bottom: 20px;
}
.feature-item {
  padding: 6px 0;
  color: #d4d4d4;
}
.upgrade-price-box {
  text-align: center;
  margin-bottom: 20px;
}
.upgrade-price {
  font-size: 32px;
  font-weight: bold;
  color: #4caf50;
}
.upgrade-price-note {
  color: #888;
  margin-left: 8px;
}
.upgrade-buttons {
  display: flex;
  gap: 12px;
}
.btn-primary {
  flex: 1;
  background: #4caf50;
  border: none;
  color: #fff;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.btn-secondary {
  flex: 1;
  background: transparent;
  border: 1px solid #3c3c3c;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.upgrade-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  color: #888;
  font-size: 20px;
  cursor: pointer;
}
```

### Step 5: 弹窗逻辑（添加到 popup.js）

```javascript
// 显示升级弹窗
function showUpgradeDialog(check) {
  const overlay = document.getElementById('upgradeOverlay');
  const reason = document.getElementById('upgradeReason');
  
  if (check.reason === 'size_limit') {
    reason.textContent = check.message;
  } else {
    reason.textContent = `${check.message}，升级解锁无限次数`;
  }
  
  overlay.style.display = 'flex';
}

// 关闭弹窗
document.getElementById('closeUpgradeBtn').onclick = () => {
  document.getElementById('upgradeOverlay').style.display = 'none';
};

// 立即购买
document.getElementById('buyNowBtn').onclick = () => {
  // TODO: 替换为 Lemon Squeezy 链接
  chrome.tabs.create({ url: 'https://jsonside.com/buy' });
};

// 输入激活码
document.getElementById('enterKeyBtn').onclick = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('license.html') });
};
```

### Step 6: 历史记录扩容

```javascript
// 修改 saveToHistory 函数中的 MAX_HISTORY
async function saveToHistory(jsonText, source = 'manual') {
  // ... 前面的代码不变 ...
  
  // 动态获取最大历史条数
  const MAX_HISTORY = (await isProUser()) ? 1000 : 50;
  
  // ... 后面的代码不变 ...
}
```

### Step 7: 激活页面（license.html）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>激活 JSON Side Pro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #1e1e1e;
      color: #d4d4d4;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: #252526;
      border: 1px solid #3c3c3c;
      border-radius: 12px;
      padding: 32px;
      width: 400px;
      text-align: center;
    }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #888; margin-bottom: 24px; }
    input {
      width: 100%;
      padding: 12px;
      background: #1e1e1e;
      border: 1px solid #3c3c3c;
      border-radius: 6px;
      color: #d4d4d4;
      font-size: 14px;
      margin-bottom: 16px;
    }
    input:focus { outline: none; border-color: #0e639c; }
    button {
      width: 100%;
      padding: 12px;
      background: #0e639c;
      border: none;
      border-radius: 6px;
      color: #fff;
      font-size: 14px;
      cursor: pointer;
    }
    button:hover { background: #1177bb; }
    .result { margin-top: 16px; padding: 12px; border-radius: 6px; }
    .success { background: rgba(76,175,50,0.2); color: #4caf50; }
    .error { background: rgba(244,67,54,0.2); color: #f44336; }
  </style>
</head>
<body>
  <div class="container">
    <h1>激活 Pro 版本</h1>
    <p class="subtitle">输入购买后收到的激活码</p>
    <input type="text" id="licenseInput" placeholder="JSIDE-XXXX-XXXX-XXXX">
    <button id="activateBtn">激活</button>
    <div id="result" class="result" style="display:none;"></div>
  </div>
  <script src="license.js"></script>
</body>
</html>
```

### Step 8: 激活逻辑（license.js）

```javascript
// 简单的激活码验证
async function activateLicense() {
  const input = document.getElementById('licenseInput');
  const result = document.getElementById('result');
  const key = input.value.trim().toUpperCase();
  
  // 格式验证
  if (!/^JSIDE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
    showResult('激活码格式不正确', false);
    return;
  }
  
  // TODO: 在线验证（后续接入）
  // 现在先做简单的本地验证
  
  // 存储激活码
  await chrome.storage.local.set({ licenseKey: key });
  
  showResult('激活成功！请刷新页面使用 Pro 功能', true);
}

function showResult(message, success) {
  const result = document.getElementById('result');
  result.textContent = message;
  result.className = 'result ' + (success ? 'success' : 'error');
  result.style.display = 'block';
}

document.getElementById('activateBtn').onclick = activateLicense;

// 回车激活
document.getElementById('licenseInput').onkeydown = (e) => {
  if (e.key === 'Enter') activateLicense();
};
```

---

## 支付流程

```
用户使用 Diff → 触发限制 → 弹窗提示升级
                      ↓
              点击"立即购买"
                      ↓
           跳转 Lemon Squeezy 付款
                      ↓
              付款成功，邮件发送激活码
                      ↓
              用户在插件中输入激活码
                      ↓
                 本地存储，解锁 Pro
```

---

## 后续接入

### Lemon Squeezy 配置
1. 注册账号 lemonsqueezy.com
2. 创建产品：JSON Side Diff Pro - $19
3. 获取付款链接，替换 `buyNowBtn` 的 URL
4. 配置 Webhook 发送激活码邮件

### 在线验证（可选）
- 用 Cloudflare Workers 搭建验证 API
- 或直接调用 Lemon Squeezy 的验证 API

---

## 验证测试

1. ✅ 免费用户 Diff 次数限制生效
2. ✅ 免费用户 Diff 大小限制生效
3. ✅ 升级弹窗正常显示
4. ✅ 激活码验证流程正常
5. ✅ Pro 用户无限制
6. ✅ 历史记录扩容生效
