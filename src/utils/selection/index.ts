/**
 * Selection utilities barrel exports.
 * Provides unified word selection calculation across PDF, ePub, and Preview contexts.
 */

// Normalizer utilities
export {
  normalizeForComparison,
  splitIntoWords,
  extractAlphanumeric,
  countWordsBefore,
  findBestWordMatch,
} from './normalizer';

// Strategy types and classes
export type {
  WordSelectionResult,
  SelectionStrategy,
  DOMSelectionConfig,
  ContentSelectionConfig,
  ElementSelectionConfig,
} from './strategies';

export {
  DOMSelectionStrategy,
  ContentSelectionStrategy,
  ElementSelectionStrategy,
} from './strategies';

// Calculator
export type {
  SelectionStrategyType,
  SelectionConfig,
} from './calculator';

export {
  WordSelectionCalculator,
  calculateFromDOMSelection,
  calculateFromContentSelection,
  calculateFromElementSelection,
} from './calculator';
