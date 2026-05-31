/**
 * JSON Side - Background Service Worker
 * 处理右键菜单事件，获取选中文本并打开格式化页面
 */

// 历史记录限制
const MAX_HISTORY = 50;
const MAX_HISTORY_ITEM_SIZE = 100 * 1024; // 100KB

// 扩展安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'format-json',
    title: 'Format JSON',
    contexts: ['selection'] // 仅在选中文本时显示
  });
});

// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'format-json') return;

  // 获取选中的文本
  const selectedText = info.selectionText;

  if (!selectedText || selectedText.trim() === '') {
    return;
  }

  // V4: 限制单条历史记录大小
  if (selectedText.length > MAX_HISTORY_ITEM_SIZE) {
    // 超过大小限制，直接打开格式化页面但不保存历史
    try {
      await chrome.storage.local.set({ jsonText: selectedText });
      const popupUrl = chrome.runtime.getURL('popup.html');
      await chrome.tabs.create({ url: popupUrl });
    } catch (error) {
      // 静默处理错误
    }
    return;
  }

  try {
    // 保存到历史记录
    const result = await chrome.storage.local.get('history');
    const history = result.history || [];

    // 去重
    const exists = history.findIndex(h => h.json === selectedText);
    if (exists >= 0) {
      history.splice(exists, 1);
    }

    history.unshift({
      json: selectedText,
      source: 'right-click',
      time: new Date().toISOString(),
      preview: selectedText.substring(0, 60).replace(/\n/g, ' ')
    });

    await chrome.storage.local.set({ history: history.slice(0, MAX_HISTORY) });

    // 将选中文本存储到 storage
    await chrome.storage.local.set({ jsonText: selectedText });

    // 在新标签页打开主页（popup.html）
    const popupUrl = chrome.runtime.getURL('popup.html');
    await chrome.tabs.create({ url: popupUrl });
  } catch (error) {
    // V2: 移除调试日志，避免泄露敏感数据
  }
});

// 点击扩展图标时打开新标签页
chrome.action.onClicked.addListener(() => {
  const popupUrl = chrome.runtime.getURL('popup.html');
  chrome.tabs.create({ url: popupUrl });
});
