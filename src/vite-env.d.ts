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
  }

  export interface Spine {
    items: SpineItem[];
  }

  export interface Book {
    ready: Promise<void>;
    loaded: {
      navigation: Promise<Navigation>;
    };
    packaging: Packaging;
    spine: Spine;
    load: (url: string) => Promise<unknown>;
    destroy: () => void;
  }

  function ePub(data: ArrayBuffer | string): Book;
  export default ePub;
}
