import { useMemo } from 'react';
import { formatWordWithORP } from '@/utils/orpCalculator';
import { useReader } from '@/contexts/ReaderContext';

interface RSVPDisplayProps {
  fontSize?: number;
}

/**
 * RSVP Display Komponente mit ORP-Hervorhebung.
 * Zeigt ein Wort mit dem Optimal Recognition Point rot markiert.
 */
export function RSVPDisplay({ fontSize = 48 }: RSVPDisplayProps) {
  const { state } = useReader();
  const currentWord = state.words[state.currentIndex] || '';

  const orpWord = useMemo(() => formatWordWithORP(currentWord), [currentWord]);

  if (state.words.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          Lade ein Dokument um mit dem Lesen zu beginnen
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center h-64">
      {/* ORP Marker (Dreieck oben) */}
      <div 
        className="absolute top-8 text-red-500 dark:text-red-400"
        style={{ fontSize: '16px' }}
      >
        ▼
      </div>

      {/* Wort-Container */}
      <div 
        className="flex items-center justify-center font-mono tracking-wide"
        style={{ fontSize: `${fontSize}px` }}
      >
        {/* Vor ORP - rechtsbündig */}
        <span 
          className="text-right text-gray-900 dark:text-gray-100"
          style={{ minWidth: `${fontSize * 3}px` }}
        >
          {orpWord.before}
        </span>

        {/* ORP Buchstabe - rot */}
        <span className="text-red-500 dark:text-red-400 font-bold">
          {orpWord.orp}
        </span>

        {/* Nach ORP - linksbündig */}
        <span 
          className="text-left text-gray-900 dark:text-gray-100"
          style={{ minWidth: `${fontSize * 3}px` }}
        >
          {orpWord.after}
        </span>
      </div>

      {/* ORP Marker (Linie unten) */}
      <div 
        className="absolute bottom-8 w-0.5 h-4 bg-red-500 dark:bg-red-400"
      />
    </div>
  );
}
