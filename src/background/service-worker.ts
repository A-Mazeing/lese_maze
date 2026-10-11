/**
 * Service Worker (Manifest V3).
 *
 * Regeln für MV3-Service-Worker, die hier eingehalten werden:
 *  - Alle Listener werden synchron auf oberster Ebene registriert (der Worker wird für
 *    jedes Ereignis neu gestartet; später registrierte Listener würden das Ereignis verpassen).
 *  - Es gibt keinen flüchtigen Zustand im Speicher; Zwischenergebnisse liegen in
 *    chrome.storage.session.
 *  - Jede Nachricht wird genau einmal beantwortet – auch im Fehlerfall – und der Kanal
 *    wird für asynchrone Antworten offen gehalten (`return true`).
 */
import { fail, type ExtensionRequest, type MessageResponse } from '@/types/messages';
import { dispatchRequest, purgeStalePageContent } from './handlers';

/** Nachrichten werden nur von Seiten dieser Erweiterung akzeptiert (nie von Webseiten). */
function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id) return false;
  // Content Scripts (sender.tab + keine Extension-URL) kommen nicht vor; Popup/Reader haben eine chrome-extension://-URL.
  return !sender.url || sender.url.startsWith(`chrome-extension://${chrome.runtime.id}/`);
}

function isExtensionRequest(message: unknown): message is ExtensionRequest {
  if (typeof message !== 'object' || message === null) return false;
  const candidate = message as { type?: unknown; mode?: unknown; resumeId?: unknown };
  if (candidate.type === 'READ_CURRENT_PAGE') return true;
  return (
    candidate.type === 'OPEN_READER' &&
    (candidate.mode === 'pdf' || candidate.mode === 'epub') &&
    (candidate.resumeId === undefined || typeof candidate.resumeId === 'string')
  );
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse: (response: MessageResponse<unknown>) => void) => {
  if (!isTrustedSender(sender)) {
    sendResponse(fail('Nicht autorisierter Absender.'));
    return false;
  }
  if (!isExtensionRequest(message)) {
    sendResponse(fail('Unbekannte Nachricht.'));
    return false;
  }

  dispatchRequest(message).then(sendResponse, (error: unknown) => {
    console.error('[sw] Anfrage fehlgeschlagen:', message.type, error);
    sendResponse(fail(error));
  });
  return true; // Antwort erfolgt asynchron
});

chrome.runtime.onInstalled.addListener(() => {
  void purgeStalePageContent();
});

chrome.runtime.onStartup.addListener(() => {
  void purgeStalePageContent();
});
