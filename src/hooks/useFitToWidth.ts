import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/** Kleinster Skalierungsfaktor: darunter wäre selbst ein sehr langes Wort ohnehin nicht mehr lesbar. */
const MIN_SCALE = 0.1;

/**
 * Skaliert den Inhalt (`contentRef`) so, dass er in die Breite des Containers (`containerRef`,
 * abzüglich dessen Innenabstand) passt. Der Inhalt muss seine natürliche Breite behalten
 * (`w-max`) und im Container zentriert sein; skaliert wird um die Mitte, sodass ein
 * mittiger ORP-Buchstabe an Ort und Stelle bleibt.
 *
 * Die Messung läuft vor dem Zeichnen (kein Flackern) und bei jeder Größenänderung des
 * Containers. `offsetWidth` ist von `transform` unabhängig – die Messung bleibt stabil.
 * Ohne Layout (z. B. jsdom) bleibt die Skalierung unverändert bei 1.
 */
export function useFitToWidth<C extends HTMLElement = HTMLDivElement, E extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<C>(null);
  const contentRef = useRef<E>(null);

  const fit = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const style = getComputedStyle(container);
    const available = container.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0');
    const natural = content.offsetWidth;
    const scale = natural > 0 && available > 0 ? Math.max(MIN_SCALE, Math.min(1, available / natural)) : 1;
    content.style.transform = scale < 1 ? `scale(${scale})` : '';
    content.dataset.fitScale = scale.toFixed(3);
  }, []);

  // Bei jedem Rendern neu messen (anderer Wortinhalt, Schriftgröße, Wortanzahl).
  useLayoutEffect(() => {
    fit();
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [fit]);

  return { containerRef, contentRef };
}
