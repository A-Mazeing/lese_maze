import { useMemo } from 'react';
import { formatWordWithORP } from '@/utils/orpCalculator';
import { useReader } from '@/contexts/ReaderContext';

interface RSVPDisplayProps {
  fontSize?: number;
}

/**
 * Berechnet einen Skalierungsfaktor für die Schriftgröße basierend auf der Wortlänge.
 * Lange Wörter werden automatisch verkleinert, damit sie in die Box passen.
 */
function calculateFontScale(words: string[], baseFontSize: number): number {
  if (words.length === 0) return 1;
  
  // Maximale Zeichenanzahl die bei normaler Größe komfortabel passt
  // Bei größerer Schriftgröße passen weniger Zeichen
  const maxComfortableLength = Math.max(10, Math.round(400 / baseFontSize));
  
  // Gesamtlänge aller Wörter plus Leerzeichen zwischen ihnen
  const totalLength = words.reduce((sum, word) => sum + word.length, 0) + (words.length - 1);
  const longestWord = Math.max(...words.map(w => w.length));
  
  // Verwende das Maximum aus Gesamtlänge und längstem Wort für die Berechnung
  const effectiveLength = Math.max(totalLength / words.length, longestWord);
  
  if (effectiveLength <= maxComfortableLength) return 1;
  
  // Skaliere herunter, aber nicht unter 40% der Originalgröße
  return Math.max(0.4, maxComfortableLength / effectiveLength);
}

/**
 * RSVP Display Komponente mit ORP-Hervorhebung.
 * Unterstützt die Anzeige von 1-4 Wörtern gleichzeitig.
 * Bei mehreren Wörtern wird das ORP nur beim mittleren Wort markiert.
 */
export function RSVPDisplay({ fontSize = 48 }: RSVPDisplayProps) {
  const { state } = useReader();
  
  // Hole die Wörter für den aktuellen Chunk
  const displayData = useMemo(() => {
    const { words, currentIndex, wordsPerChunk, endIndex } = state;
    const effectiveEnd = endIndex ?? words.length - 1;
    
    // Bestimme wie viele Wörter tatsächlich angezeigt werden können
    const availableWords = Math.min(wordsPerChunk, effectiveEnd - currentIndex + 1);
    const chunkWords: string[] = [];
    
    for (let i = 0; i < availableWords; i++) {
      const word = words[currentIndex + i];
      if (word) {
        chunkWords.push(word);
      }
    }
    
    // Bestimme den Index für das ORP-Wort (mittleres Wort)
    // Bei 1 Wort: Index 0
    // Bei 2 Wörtern: Index 1 (zweites Wort)
    // Bei 3 Wörtern: Index 1 (mittleres)
    // Bei 4 Wörtern: Index 2 (drittes Wort)
    const orpWordIndex = chunkWords.length <= 1 ? 0 : Math.floor(chunkWords.length / 2);
    
    return {
      chunkWords,
      orpWordIndex,
      wordsPerChunk,
    };
  }, [state]);

  if (state.words.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          Lade ein Dokument um mit dem Lesen zu beginnen
        </p>
      </div>
    );
  }

  const { chunkWords, orpWordIndex, wordsPerChunk } = displayData;

  // Single-Word-Modus (klassisches RSVP)
  if (wordsPerChunk === 1) {
    const orpWord = formatWordWithORP(chunkWords[0] || '');
    
    // Dynamische Schriftgröße basierend auf Wortlänge
    const fontScale = calculateFontScale(chunkWords, fontSize);
    const scaledFontSize = Math.round(fontSize * fontScale);
    
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
          style={{ fontSize: `${scaledFontSize}px` }}
        >
          {/* Vor ORP - rechtsbündig */}
          <span 
            className="text-right text-gray-900 dark:text-gray-100"
            style={{ minWidth: `${scaledFontSize * 3}px` }}
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
            style={{ minWidth: `${scaledFontSize * 3}px` }}
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

  // Multi-Word-Modus (2-4 Wörter)
  // Reduziere Schriftgröße basierend auf Anzahl der Wörter und Wortlänge
  const baseMultiWordFontSize = Math.round(fontSize * (wordsPerChunk === 2 ? 0.9 : wordsPerChunk === 3 ? 0.8 : 0.7));
  const fontScale = calculateFontScale(chunkWords, baseMultiWordFontSize);
  const adjustedFontSize = Math.round(baseMultiWordFontSize * fontScale);
  
  return (
    <div className="relative flex flex-col items-center justify-center h-64">
      {/* Wort-Container */}
      <div 
        className="flex items-center justify-center gap-3 font-mono tracking-wide"
        style={{ fontSize: `${adjustedFontSize}px` }}
      >
        {chunkWords.map((word, index) => {
          const isOrpWord = index === orpWordIndex;
          
          if (isOrpWord) {
            // ORP-Wort mit Markierung
            const orpWord = formatWordWithORP(word);
            return (
              <span key={index} className="relative flex items-center">
                {/* ORP Marker (Dreieck oben) */}
                <div 
                  className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-red-500 dark:text-red-400"
                  style={{ fontSize: '12px' }}
                >
                  ▼
                </div>
                
                <span className="text-gray-900 dark:text-gray-100">
                  {orpWord.before}
                </span>
                <span className="text-red-500 dark:text-red-400 font-bold">
                  {orpWord.orp}
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {orpWord.after}
                </span>
                
                {/* ORP Marker (Linie unten) */}
                <div 
                  className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-0.5 h-3 bg-red-500 dark:bg-red-400"
                />
              </span>
            );
          }
          
          // Normales Wort ohne ORP-Markierung - gleiche Farbe wie die anderen Wörter
          return (
            <span 
              key={index} 
              className="text-gray-900 dark:text-gray-100"
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
}
