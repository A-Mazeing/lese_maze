import type { ReaderState } from '@/types';
import { initialReaderState, readerReducer, type ReaderAction } from '@/contexts/readerReducer';

type Listener = () => void;

/**
 * Minimaler synchroner Store um den Reader-Reducer.
 *
 * Anders als `useReducer` liefert `getState()` unmittelbar nach `dispatch()` den
 * neuen Zustand. Das ist die Grundlage für die Wiedergabe-Engine: Sie muss nach
 * jedem Takt sofort wissen, ob die Wiedergabe weiterläuft und wie lange der
 * nächste Chunk dauert – ohne auf einen React-Render zu warten.
 */
export interface ReaderStore {
  getState(): ReaderState;
  dispatch(action: ReaderAction): void;
  subscribe(listener: Listener): () => void;
}

export function createReaderStore(initialState: ReaderState = initialReaderState): ReaderStore {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,

    dispatch(action) {
      const next = readerReducer(state, action);
      if (Object.is(next, state)) return;
      state = next;
      // Kopie, damit Listener sich während der Benachrichtigung (ab)melden dürfen.
      for (const listener of [...listeners]) listener();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
