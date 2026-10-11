// Shared UI Components

// Document Selector
export {
  DocumentSelector,
  type DocumentTypeConfig,
  type DocumentParserState,
  type DocumentMetadataDisplay,
} from './DocumentSelector';
export { PDF_CONFIG, EPUB_CONFIG } from './documentConfigs';

// Loading and Error States
export {
  LoadingState,
  LoadingOverlay,
  ErrorDisplay,
  ErrorBanner,
  EmptyState,
} from './LoadingState';

// Viewer Context Menu
export {
  ViewerContextMenu,
  type WordRange,
  type ContextMenuAction,
} from './ViewerContextMenu';

// Viewer Toolbar and Navigation
export {
  NavigationButtons,
  PageIndicator,
  StartReadingButton,
  ViewerToolbar,
  ReadingRangeInfo,
  ReadingRangeEstimate,
  ViewerInstructions,
} from './ViewerToolbar';
