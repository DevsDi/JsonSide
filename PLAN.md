# Diff Paid + History Feature Implementation Plan

## Goal
Implement Diff feature one-time payment ($9 early bird) + history record expansion, validate market payment willingness.

---

## 💰 Pricing

| Phase | Price | Condition |
|-------|-------|-----------|
| **Early Bird** | **$9** | First 50 users |
| Regular Price | $15 | After early bird ends |

**Pricing Rationale**:
- Browser extension users' psychological price range: $5-15
- $9 is less than a cup of coffee, low decision barrier
- Quickly validate market payment willingness

---

## Product Design

### Free Tier Limits
```
Diff:
├── 3 per day
├── Max 10KB per comparison
└── No export feature

History:
└── 50 local records
```

### Pro Tier Benefits ($9 One-Time)
```
Diff:
├── Unlimited comparisons
├── Max 10MB per comparison
└── Export HTML report

History:
└── 1000 local records
```

---

## File Change List

| File | Action | Description |
|------|--------|-------------|
| `popup.js` | Modify | Add payment restriction logic |
| `popup.html` | Modify | Add upgrade popup UI + CSS |
| `license.html` | Create | License key input page |
| `license.js` | Create | License activation verification logic |

---

## Implementation Steps

### Step 1: Payment Restriction Logic (popup.js)

```javascript
// ========== Payment Restriction Config ==========
const FREE_DIFF_LIMIT = 3;              // Free daily limit
const FREE_DIFF_SIZE = 10 * 1024;       // Free max 10KB
const PRO_DIFF_SIZE = 10 * 1024 * 1024; // Pro max 10MB

// Check if Pro user
async function isProUser() {
  const result = await chrome.storage.local.get('licenseKey');
  return !!result.licenseKey;
}

// Get today's Diff usage count
async function getTodayDiffUsage() {
  const result = await chrome.storage.local.get(['diffUsageDate', 'diffUsageCount']);
  const today = new Date().toDateString();

  if (result.diffUsageDate !== today) {
    await chrome.storage.local.set({ diffUsageDate: today, diffUsageCount: 0 });
    return 0;
  }
  return result.diffUsageCount || 0;
}

// Check if Diff can be used
async function canUseDiff(inputSize) {
  if (await isProUser()) return { allowed: true, isPro: true };

  // Check file size
  if (inputSize > FREE_DIFF_SIZE) {
    return {
      allowed: false,
      reason: 'size_limit',
      message: `Free tier max 10KB, current ${(inputSize/1024).toFixed(1)}KB`
    };
  }

  // Check usage count
  const usage = await getTodayDiffUsage();
  if (usage >= FREE_DIFF_LIMIT) {
    return {
      allowed: false,
      reason: 'count_limit',
      message: `Already used ${usage} times today`
    };
  }

  return { allowed: true, usage, isPro: false };
}

// Record Diff usage
async function recordDiffUsage() {
  if (await isProUser()) return;
  const usage = await getTodayDiffUsage();
  await chrome.storage.local.set({ diffUsageCount: usage + 1 });
}
```

### Step 2: Modify compareBtn.onclick

```javascript
// Modified code:
compareBtn.onclick = async () => {
  const textA = cleanJsonText(diffOutputA.innerText);
  const textB = cleanJsonText(diffOutputB.innerText);
  const inputSize = textA.length + textB.length;

  // Check payment restriction
  const check = await canUseDiff(inputSize);
  if (!check.allowed) {
    showUpgradeDialog(check);
    return;
  }

  // Original logic...

  // Record usage count
  await recordDiffUsage();

  // Show remaining count (free users)
  if (!check.isPro) {
    updateDiffUsageDisplay(check.usage + 1);
  }
};
```

### Step 3: Upgrade Popup UI (add to popup.html)

```html
<!-- Upgrade popup -->
<div id="upgradeOverlay" class="upgrade-overlay" style="display:none;">
  <div class="upgrade-dialog">
    <div class="upgrade-header">
      <span class="upgrade-icon">⭐</span>
      <h2>Upgrade to Diff Pro</h2>
    </div>
    <p id="upgradeReason" class="upgrade-reason"></p>
    <div class="upgrade-features">
      <div class="feature-item">✓ Unlimited Diff comparisons</div>
      <div class="feature-item">✓ Max 10MB per comparison</div>
      <div class="feature-item">✓ Export HTML report</div>
      <div class="feature-item">✓ 1000 history records</div>
    </div>
    <div class="upgrade-price-box">
      <span class="upgrade-price">$19</span>
      <span class="upgrade-price-note">Lifetime</span>
    </div>
    <div class="upgrade-buttons">
      <button id="buyNowBtn" class="btn-primary">Buy Now</button>
      <button id="enterKeyBtn" class="btn-secondary">Enter License Key</button>
    </div>
    <button id="closeUpgradeBtn" class="upgrade-close">×</button>
  </div>
</div>
```

### Step 4: Upgrade Popup CSS (add to popup.html style)

```css
/* Upgrade popup styles */
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

### Step 5: Popup Logic (add to popup.js)

```javascript
// Show upgrade popup
function showUpgradeDialog(check) {
  const overlay = document.getElementById('upgradeOverlay');
  const reason = document.getElementById('upgradeReason');

  if (check.reason === 'size_limit') {
    reason.textContent = check.message;
  } else {
    reason.textContent = `${check.message}. Upgrade for unlimited usage`;
  }

  overlay.style.display = 'flex';
}

// Close popup
document.getElementById('closeUpgradeBtn').onclick = () => {
  document.getElementById('upgradeOverlay').style.display = 'none';
};

// Buy now
document.getElementById('buyNowBtn').onclick = () => {
  // TODO: Replace with Lemon Squeezy link
  chrome.tabs.create({ url: 'https://jsonside.com/buy' });
};

// Enter license key
document.getElementById('enterKeyBtn').onclick = () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('license.html') });
};
```

### Step 6: History Record Expansion

```javascript
// Modify MAX_HISTORY in saveToHistory function
async function saveToHistory(jsonText, source = 'manual') {
  // ... preceding code unchanged ...

  // Dynamically get max history count
  const MAX_HISTORY = (await isProUser()) ? 1000 : 50;

  // ... following code unchanged ...
}
```

### Step 7: Activation Page (license.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Activate JSON Side Pro</title>
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
    <h1>Activate Pro Version</h1>
    <p class="subtitle">Enter the license key received after purchase</p>
    <input type="text" id="licenseInput" placeholder="JSIDE-XXXX-XXXX-XXXX">
    <button id="activateBtn">Activate</button>
    <div id="result" class="result" style="display:none;"></div>
  </div>
  <script src="license.js"></script>
</body>
</html>
```

### Step 8: Activation Logic (license.js)

```javascript
// Simple license key verification
async function activateLicense() {
  const input = document.getElementById('licenseInput');
  const result = document.getElementById('result');
  const key = input.value.trim().toUpperCase();

  // Format validation
  if (!/^JSIDE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
    showResult('Invalid license key format', false);
    return;
  }

  // TODO: Online verification (to be integrated later)
  // Simple local verification for now

  // Store license key
  await chrome.storage.local.set({ licenseKey: key });

  showResult('Activation successful! Refresh the page to use Pro features', true);
}

function showResult(message, success) {
  const result = document.getElementById('result');
  result.textContent = message;
  result.className = 'result ' + (success ? 'success' : 'error');
  result.style.display = 'block';
}

document.getElementById('activateBtn').onclick = activateLicense;

// Enter key to activate
document.getElementById('licenseInput').onkeydown = (e) => {
  if (e.key === 'Enter') activateLicense();
};
```

---

## Payment Flow

```
User uses Diff → Triggers limit → Popup shows upgrade
                      ↓
              Click "Buy Now"
                      ↓
           Redirect to Lemon Squeezy payment
                      ↓
              Payment success, email sends license key
                      ↓
              User enters license key in extension
                      ↓
                 Local storage, unlock Pro
```

---

## Future Integration

### Lemon Squeezy Setup
1. Register account at lemonsqueezy.com
2. Create product: JSON Side Diff Pro - $19
3. Get payment link, replace `buyNowBtn` URL
4. Configure Webhook to send license key emails

### Online Verification (Optional)
- Build verification API with Cloudflare Workers
- Or directly call Lemon Squeezy's verification API

---

## Verification Tests

1. ✅ Free user Diff count limit works
2. ✅ Free user Diff size limit works
3. ✅ Upgrade popup displays correctly
4. ✅ License key verification flow works
5. ✅ Pro user has no limits
6. ✅ History record expansion works
