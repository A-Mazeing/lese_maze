import type { BookTip } from './types';

/**
 * Handverlesene Buchtipps zum Thema Lesen und Konzentration. Die Auswahl hängt weder vom Inhalt
 * noch vom Verlauf des Lesens ab – es werden keine Nutzerdaten ausgewertet. Neue Tipps einfach
 * ergänzen; angezeigt wird je Kalendertag einer.
 */
export const BOOK_TIPS: readonly BookTip[] = [
  {
    id: 'deep-work',
    author: 'Cal Newport',
    title: { en: 'Deep Work', de: 'Konzentriert arbeiten' },
    query: { en: 'Cal Newport Deep Work', de: 'Cal Newport Konzentriert arbeiten' },
  },
  {
    id: 'how-to-read-a-book',
    author: 'Mortimer J. Adler',
    title: { en: 'How to Read a Book', de: 'How to Read a Book' },
    query: { en: 'Adler How to Read a Book', de: 'Adler How to Read a Book' },
  },
  {
    id: 'thinking-fast-and-slow',
    author: 'Daniel Kahneman',
    title: { en: 'Thinking, Fast and Slow', de: 'Schnelles Denken, langsames Denken' },
    query: { en: 'Kahneman Thinking, Fast and Slow', de: 'Kahneman Schnelles Denken, langsames Denken' },
  },
  {
    id: 'atomic-habits',
    author: 'James Clear',
    title: { en: 'Atomic Habits', de: 'Die 1%-Methode' },
    query: { en: 'James Clear Atomic Habits', de: 'James Clear Die 1%-Methode' },
  },
  {
    id: 'the-shallows',
    author: 'Nicholas Carr',
    title: { en: 'The Shallows', de: 'Wer bin ich, wenn ich online bin' },
    query: { en: 'Nicholas Carr The Shallows', de: 'Nicholas Carr Wer bin ich, wenn ich online bin' },
  },
];
