/// <reference types="vite/client" />

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module 'epubjs' {
  export interface NavItem {
    href: string;
    label: string;
  }

  export interface Navigation {
    toc: NavItem[];
  }

  export interface PackagingMetadata {
    title: string;
    creator: string;
  }

  export interface Packaging {
    metadata: PackagingMetadata;
  }

  export interface SpineItem {
    load: (loader: unknown) => Promise<Document>;
    href?: string;
    url?: string;
    cfiBase?: string;
  }

  export interface Spine {
    items: SpineItem[];
  }

  export interface Location {
    start: {
      cfi: string;
      index: number;
      href: string;
      displayed: {
        page: number;
        total: number;
      };
    };
    end: {
      cfi: string;
      index: number;
      href: string;
    };
    atStart?: boolean;
    atEnd?: boolean;
  }

  export interface RenditionOptions {
    width?: string | number;
    height?: string | number;
    flow?: 'paginated' | 'scrolled' | 'scrolled-doc';
    spread?: 'none' | 'always' | 'auto';
    minSpreadWidth?: number;
    manager?: 'default' | 'continuous';
    snap?: boolean;
  }

  export interface ThemeStyles {
    [selector: string]: {
      [property: string]: string;
    };
  }

  export interface Themes {
    default: (styles: ThemeStyles) => void;
    register: (name: string, styles: ThemeStyles) => void;
    select: (name: string) => void;
  }

  export interface Rendition {
    display: (target?: string) => Promise<void>;
    next: () => Promise<void>;
    prev: () => Promise<void>;
    destroy: () => void;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    off: (event: string, callback: (...args: unknown[]) => void) => void;
    themes: Themes;
    currentLocation: () => Location;
    getRange: (cfi: string) => Range | null;
  }

  export interface Locations {
    generate: (chars?: number) => Promise<string[]>;
    length: () => number;
    locationFromCfi: (cfi: string) => number;
    cfiFromLocation: (location: number) => string;
    cfiFromPercentage: (percentage: number) => string;
    percentageFromCfi: (cfi: string) => number;
  }

  export interface Book {
    ready: Promise<void>;
    loaded: {
      navigation: Promise<Navigation>;
    };
    packaging: Packaging;
    spine: Spine;
    locations: Locations;
    load: (url: string) => Promise<unknown>;
    destroy: () => void;
    renderTo: (element: HTMLElement, options?: RenditionOptions) => Rendition;
  }

  function ePub(data: ArrayBuffer | string): Book;
  export default ePub;
  export { Book, Rendition, Location, Locations, Themes };
}
