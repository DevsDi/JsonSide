/**
 * JSON Formatter - Background Service Worker
 * 处理右键菜单事件，获取选中文本并打开格式化页面
 */

// 扩展安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'format-json',
    title: '格式化 JSON',
    contexts: ['selection'] // 仅在选中文本时显示
  });
  console.log('JSON Formatter: 右键菜单已创建');
});

// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'format-json') return;

  // 获取选中的文本
  const selectedText = info.selectionText;

  if (!selectedText || selectedText.trim() === '') {
    console.log('JSON Formatter: 未选中文本');
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

    await chrome.storage.local.set({ history: history.slice(0, 50) });

    // 将选中文本存储到 storage
    await chrome.storage.local.set({ jsonText: selectedText });

    // 在新标签页打开主页（popup.html）
    const popupUrl = chrome.runtime.getURL('popup.html');
    await chrome.tabs.create({ url: popupUrl });

    console.log('JSON Formatter: 已打开格式化页面');
  } catch (error) {
    console.error('JSON Formatter: 处理失败', error);
  }
});

// 点击扩展图标时打开新标签页
chrome.action.onClicked.addListener(() => {
  const popupUrl = chrome.runtime.getURL('popup.html');
  chrome.tabs.create({ url: popupUrl });
});
