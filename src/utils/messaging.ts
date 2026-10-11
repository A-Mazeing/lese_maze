import type { ExtensionRequest, MessageResponse } from '@/types/messages';
import { fail } from '@/types/messages';
import { t } from '@/i18n';

/** Wie lange auf eine Antwort des Service Workers gewartet wird (Seiten-Extraktion eingeschlossen). */
const RESPONSE_TIMEOUT_MS = 20_000;

/**
 * Sendet eine Anfrage an den Service Worker und liefert IMMER eine `MessageResponse`.
 *
 * - Fehler von `chrome.runtime.sendMessage` ("Receiving end does not exist", geschlossener
 *   Port) werden in `{ ok: false }` übersetzt, statt als Promise-Rejection zu enden.
 * - Bleibt die Antwort aus (z. B. weil der Service Worker abstürzt), greift ein Timeout.
 */
export async function sendRequest<T = undefined>(request: ExtensionRequest): Promise<MessageResponse<T>> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return fail(t('error.apiUnavailable'));
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<MessageResponse<T>>((resolve) => {
      timer = setTimeout(() => resolve(fail(t('error.timeout'))), RESPONSE_TIMEOUT_MS);
    });
    const response = (await Promise.race([
      chrome.runtime.sendMessage(request) as Promise<MessageResponse<T> | undefined>,
      timeout,
    ])) as MessageResponse<T> | undefined;

    if (response && typeof response === 'object' && 'ok' in response) return response;
    return fail(t('error.unexpectedResponse'));
  } catch (error) {
    return fail(error);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
