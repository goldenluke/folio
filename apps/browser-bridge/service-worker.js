const endpoint = 'http://127.0.0.1:38373/capture';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'folio-capture', title: 'Capturar no Folio', contexts: ['page', 'selection'] });
});

const selectionFromPage = async (tabId) => {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.getSelection()?.toString() ?? '',
  });
  return result?.result || undefined;
};

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'folio-capture' || tab?.id === undefined || tab.url === undefined) return;
  try {
    const selection = info.selectionText || await selectionFromPage(tab.id);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: 1, url: tab.url, title: tab.title || undefined, selection: selection || undefined, capturedAt: new Date().toISOString() }),
    });
    if (!response.ok) throw new Error('bridge indisponível');
  } catch {
    // A extensão não retém conteúdo: se o desktop não estiver aberto, basta tentar novamente.
  }
});
