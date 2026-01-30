/**
 * Content Script für das Extrahieren von Seiteninhalt.
 * Wird auf allen Webseiten geladen.
 */

// Listener für Nachrichten vom Background Script oder Popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    const content = extractPageContent();
    sendResponse(content);
  }
  
  return false;
});

/**
 * Extrahiert den Hauptinhalt einer Webseite.
 */
function extractPageContent() {
  // Versuche den Hauptinhalt zu finden
  const mainSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
    '#main',
  ];

  let contentElement: Element | null = null;
  
  for (const selector of mainSelectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) break;
  }

  // Fallback auf body
  if (!contentElement) {
    contentElement = document.body;
  }

  // Klone Element um es zu modifizieren
  const clone = contentElement.cloneNode(true) as Element;
  
  // Entferne unerwünschte Elemente
  const unwantedSelectors = [
    'script',
    'style',
    'noscript',
    'nav',
    'header',
    'footer',
    'aside',
    '.sidebar',
    '.navigation',
    '.menu',
    '.comments',
    '.advertisement',
    '.ad',
    '[role="navigation"]',
    '[role="complementary"]',
  ];
  
  unwantedSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  return {
    content: clone.innerHTML,
    title: document.title,
    url: window.location.href,
  };
}

export {};
