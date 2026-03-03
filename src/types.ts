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
}

/**
 * Detected content format
 */
export enum ContentFormat {
  Unknown = 'unknown',
  AsciiDoc = 'asciidoc',
  Markdown = 'markdown',
  Plain = 'plain'
}
