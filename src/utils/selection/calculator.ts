/**
 * WordSelectionCalculator - Unified word selection calculation.
 * Provides a clean API for calculating word indices across different contexts.
 */

import {
  SelectionStrategy,
  WordSelectionResult,
  DOMSelectionStrategy,
  DOMSelectionConfig,
  ContentSelectionStrategy,
  ContentSelectionConfig,
  ElementSelectionStrategy,
  ElementSelectionConfig,
} from './strategies';

/**
 * Strategy type identifiers.
 */
export type SelectionStrategyType = 'dom' | 'content' | 'element';

/**
 * Configuration union type for different strategies.
 */
export type SelectionConfig =
  | { type: 'dom'; config: DOMSelectionConfig }
  | { type: 'content'; config: ContentSelectionConfig }
  | { type: 'element'; config: ElementSelectionConfig };

/**
 * Factory for creating selection strategies.
 */
function createStrategy(selectionConfig: SelectionConfig): SelectionStrategy {
  switch (selectionConfig.type) {
    case 'dom':
      return new DOMSelectionStrategy(selectionConfig.config);
    case 'content':
      return new ContentSelectionStrategy(selectionConfig.config);
    case 'element':
      return new ElementSelectionStrategy(selectionConfig.config);
    default:
      throw new Error(`Unknown selection strategy type: ${(selectionConfig as any).type}`);
  }
}

/**
 * WordSelectionCalculator class.
 * Provides a unified interface for calculating word selection indices.
 */
export class WordSelectionCalculator {
  private strategy: SelectionStrategy;

  constructor(config: SelectionConfig) {
    this.strategy = createStrategy(config);
  }

  /**
   * Calculate word indices using the configured strategy.
   * @returns Word selection result or null if invalid
   */
  calculate(): WordSelectionResult | null {
    return this.strategy.calculate();
  }

  /**
   * Static factory method for DOM-based selection (PDF).
   */
  static forDOM(config: DOMSelectionConfig): WordSelectionCalculator {
    return new WordSelectionCalculator({ type: 'dom', config });
  }

  /**
   * Static factory method for content-based selection (ePub).
   */
  static forContent(config: ContentSelectionConfig): WordSelectionCalculator {
    return new WordSelectionCalculator({ type: 'content', config });
  }

  /**
   * Static factory method for element-based selection (Preview).
   */
  static forElement(config: ElementSelectionConfig): WordSelectionCalculator {
    return new WordSelectionCalculator({ type: 'element', config });
  }
}

/**
 * Convenience functions for quick calculations without class instantiation.
 */

/**
 * Calculate word indices from DOM selection (PDF).
 */
export function calculateFromDOMSelection(
  config: DOMSelectionConfig
): WordSelectionResult | null {
  return WordSelectionCalculator.forDOM(config).calculate();
}

/**
 * Calculate word indices from content search (ePub).
 */
export function calculateFromContentSelection(
  config: ContentSelectionConfig
): WordSelectionResult | null {
  return WordSelectionCalculator.forContent(config).calculate();
}

/**
 * Calculate word indices from element attributes (Preview).
 */
export function calculateFromElementSelection(
  config: ElementSelectionConfig
): WordSelectionResult | null {
  return WordSelectionCalculator.forElement(config).calculate();
}
