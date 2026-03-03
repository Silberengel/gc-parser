/**
 * Options for configuring the parser behavior
 */
export interface ParserOptions {
  /** Base URL for rewriting relative links and nostr: addresses */
  linkBaseURL?: string;
  /** Enable AsciiDoc processing (default: true) */
  enableAsciiDoc?: boolean;
  /** Enable Markdown processing (default: true) */
  enableMarkdown?: boolean;
  /** Enable code syntax highlighting (default: true) */
  enableCodeHighlighting?: boolean;
  /** Enable LaTeX math rendering (default: true) */
  enableLaTeX?: boolean;
  /** Enable musical notation rendering (default: true) */
  enableMusicalNotation?: boolean;
  /** Enable nostr: address processing (default: true) */
  enableNostrAddresses?: boolean;
}

/**
 * Nostr link information
 */
export interface NostrLink {
  type: 'npub' | 'nprofile' | 'nevent' | 'naddr' | 'note';
  id: string;
  text: string;
  bech32: string;
}

/**
 * Wikilink information
 */
export interface Wikilink {
  dtag: string;
  display: string;
  original: string;
}

/**
 * Result of processing content
 */
export interface ProcessResult {
  /** Main processed HTML content */
  content: string;
  /** Extracted table of contents (for AsciiDoc) */
  tableOfContents: string;
  /** Indicates if LaTeX content was found */
  hasLaTeX: boolean;
  /** Indicates if musical notation was found */
  hasMusicalNotation: boolean;
  /** Extracted Nostr links */
  nostrLinks: NostrLink[];
  /** Extracted wikilinks */
  wikilinks: Wikilink[];
  /** Extracted hashtags */
  hashtags: string[];
  /** Extracted regular links */
  links: Array<{ url: string; text: string; isExternal: boolean }>;
  /** Extracted media URLs */
  media: string[];
}

/**
 * Detected content format
 */
export enum ContentFormat {
  Unknown = 'unknown',
  AsciiDoc = 'asciidoc',
  Markdown = 'markdown',
  Wikipedia = 'wikipedia',
  Plain = 'plain'
}
