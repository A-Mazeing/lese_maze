/**
 * Chrome Extension Service Worker.
 * Verarbeitet Hintergrund-Aufgaben und Kommunikation.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('RSVP Speed Reader installed');
});

// Listener für Nachrichten von Popup oder Content Scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'OPEN_PDF_READER':
      chrome.tabs.create({ url: chrome.runtime.getURL('src/reader/index.html?mode=pdf') });
      sendResponse({ success: true });
      break;
      
    case 'OPEN_EPUB_READER':
      chrome.tabs.create({ url: chrome.runtime.getURL('src/reader/index.html?mode=epub') });
      sendResponse({ success: true });
      break;
      
    case 'READ_CURRENT_PAGE':
      handleReadCurrentPage(sendResponse);
      return true; // Keep channel open for async response
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return false;
});

async function handleReadCurrentPage(sendResponse: (response: unknown) => void) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.id) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }

    // Prüfe ob es eine chrome:// oder extension:// URL ist
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      sendResponse({ success: false, error: 'Cannot read content from browser pages' });
      return;
    }

    // Injiziere Content Script falls nötig
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content/content.ts'],
      });
    } catch {
      // Content Script könnte bereits injiziert sein, ignorieren
    }

    // Warte kurz, damit der Content Script seinen Listener registrieren kann
    await new Promise(resolve => setTimeout(resolve, 100));

    // Hole Seiteninhalt mit Retry-Logik
    let response = null;
    let retries = 3;

    while (retries > 0 && !response) {
      try {
        response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
      } catch (err) {
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 150));
        } else {
          throw err;
        }
      }
    }
    
    if (response && response.content) {
      // Speichere Inhalt in session storage BEVOR der Reader-Tab geöffnet wird
      await chrome.storage.session.set({
        pageContent: {
          content: response.content,
          title: response.title,
          url: response.url,
          timestamp: Date.now(),
        }
      });
      
      // Öffne Reader mit dem Inhalt in Split-Ansicht
      const readerUrl = chrome.runtime.getURL('src/reader/index.html?mode=page&view=split');
      await chrome.tabs.create({ url: readerUrl });
      
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Could not get page content' });
    }
  } catch (error) {
    console.error('Error reading page:', error);
    sendResponse({ success: false, error: String(error) });
  }
}

export {};
