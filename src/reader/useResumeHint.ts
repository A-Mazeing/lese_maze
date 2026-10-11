import { useEffect, useState } from 'react';
import { getProgress } from '@/utils/storage';
import type { BookProgress } from '@/types';

/**
 * Lädt den gespeicherten Fortschritt zu `?resume=<id>`. Die Datei selbst wird aus
 * Datenschutz- und Speichergründen nicht abgelegt; der Reader weist deshalb darauf hin,
 * dieselbe Datei erneut zu wählen (die Position wird dann automatisch wiederhergestellt).
 */
export function useResumeHint(resumeId: string | null): BookProgress | null {
  const [hint, setHint] = useState<BookProgress | null>(null);

  useEffect(() => {
    if (!resumeId) return;
    let cancelled = false;
    void getProgress(resumeId).then((progress) => {
      if (!cancelled) setHint(progress);
    });
    return () => {
      cancelled = true;
    };
  }, [resumeId]);

  return resumeId ? hint : null;
}
