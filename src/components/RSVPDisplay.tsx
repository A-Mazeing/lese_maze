import { memo, useMemo } from 'react';
import { useReaderSelector } from '@/contexts/ReaderContext';
import { getEffectiveEnd } from '@/contexts/readerReducer';
import { useFitToWidth } from '@/hooks/useFitToWidth';
import { useT } from '@/i18n';
import { formatWordWithORP } from '@/utils/orpCalculator';

interface RSVPDisplayProps {
  fontSize?: number;
}

const MULTI_WORD_SCALE: Record<number, number> = { 2: 0.9, 3: 0.8, 4: 0.7 };

/**
 * RSVP-Anzeige mit ORP-Hervorhebung (1-4 Wörter gleichzeitig).
 *
 * Passt der Inhalt nicht in die Breite (langes Wort, mehrere Wörter, schmales Panel), wird er
 * gemessen und gleichmäßig verkleinert (`useFitToWidth`) – nichts ragt mehr heraus.
 *
 * Layout: Ein dreispaltiges Raster (`1fr auto 1fr`) hält den ORP-Buchstaben exakt in der
 * Mitte – unabhängig von der Länge des Wortes davor/danach und von der Schriftart.
 * (Feste `minWidth`-Werte, wie zuvor, verschieben das Wort ab einer bestimmten Länge.)
 */
export const RSVPDisplay = memo(function RSVPDisplay({ fontSize = 48 }: RSVPDisplayProps) {
  const t = useT();
  const { containerRef, contentRef } = useFitToWidth();
  const words = useReaderSelector((s) => s.words);
  const currentIndex = useReaderSelector((s) => s.currentIndex);
  const wordsPerChunk = useReaderSelector((s) => s.wordsPerChunk);
  const endIndex = useReaderSelector((s) => s.endIndex);

  const chunk = useMemo(() => {
    const end = getEffectiveEnd({ words, endIndex });
    const last = Math.min(end, currentIndex + wordsPerChunk - 1);
    const result: string[] = [];
    for (let i = currentIndex; i <= last; i++) {
      if (words[i]) result.push(words[i]);
    }
    return result;
  }, [words, currentIndex, wordsPerChunk, endIndex]);

  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          {t('display.empty')}
        </p>
      </div>
    );
  }

  const label = chunk.join(' ');

  // Klassisches RSVP: ein Wort, ORP-Buchstabe fest in der Mitte.
  if (chunk.length <= 1) {
    const orp = formatWordWithORP(chunk[0] ?? '');

    return (
      <div
        ref={containerRef}
        className="relative flex flex-col items-center justify-center h-64 px-4 overflow-hidden"
        role="img"
        aria-label={label}
        data-testid="rsvp-display"
      >
        <div aria-hidden="true" className="absolute top-8 text-red-500 dark:text-red-400 text-base">▼</div>

        <div
          ref={contentRef}
          aria-hidden="true"
          className="grid w-max items-baseline font-mono tracking-wide whitespace-nowrap select-none"
          style={{ gridTemplateColumns: '1fr auto 1fr', fontSize: `${fontSize}px` }}
        >
          <span className="justify-self-end text-gray-900 dark:text-gray-100" data-testid="rsvp-before">{orp.before}</span>
          <span className="text-red-500 dark:text-red-400 font-bold" data-testid="rsvp-orp">{orp.orp}</span>
          <span className="justify-self-start text-gray-900 dark:text-gray-100" data-testid="rsvp-after">{orp.after}</span>
        </div>

        <div aria-hidden="true" className="absolute bottom-8 w-0.5 h-4 bg-red-500 dark:bg-red-400" />
      </div>
    );
  }

  // Mehrere Wörter: ORP nur im mittleren Wort markiert.
  const size = Math.round(fontSize * (MULTI_WORD_SCALE[chunk.length] ?? 0.7));
  const orpWordIndex = Math.floor(chunk.length / 2);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center h-64 px-4 overflow-hidden"
      role="img"
      aria-label={label}
      data-testid="rsvp-display"
    >
      <div
        ref={contentRef}
        aria-hidden="true"
        className="flex w-max items-center justify-center gap-3 font-mono tracking-wide whitespace-nowrap select-none"
        style={{ fontSize: `${size}px` }}
      >
        {chunk.map((word, index) => {
          if (index !== orpWordIndex) {
            return (
              <span key={index} className="text-gray-600 dark:text-gray-400">
                {word}
              </span>
            );
          }
          const orp = formatWordWithORP(word);
          return (
            <span key={index} className="relative flex items-center">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-red-500 dark:text-red-400 text-xs">▼</span>
              <span className="text-gray-900 dark:text-gray-100">{orp.before}</span>
              <span className="text-red-500 dark:text-red-400 font-bold">{orp.orp}</span>
              <span className="text-gray-900 dark:text-gray-100">{orp.after}</span>
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-red-500 dark:bg-red-400" />
            </span>
          );
        })}
      </div>
    </div>
  );
});
