import { ParserOptions, ProcessResult, ContentFormat } from './types';
import { detectFormat } from './detector';
import { convertToAsciidoc } from './converters/to-asciidoc';
import { processAsciidoc } from './processors/asciidoc';
import { extractMetadata } from './extractors/metadata';

/**
 * Default parser options
 */
export function defaultOptions(): ParserOptions {
  return {
    linkBaseURL: '',
    enableAsciiDoc: true,
    enableMarkdown: true,
    enableCodeHighlighting: true,
    enableLaTeX: true,
    enableMusicalNotation: true,
    enableNostrAddresses: true,
  };
}

/**
 * Main parser for Nostr event content
 * Handles multiple content formats: AsciiDoc, Markdown, code syntax,
 * LaTeX, musical notation, and nostr: prefixed addresses
 * 
 * Everything is converted to AsciiDoc first, then processed through AsciiDoctor
 */
export class Parser {
  private options: Required<ParserOptions>;

  constructor(options: ParserOptions = {}) {
    const defaults = defaultOptions();
    this.options = {
      linkBaseURL: options.linkBaseURL ?? defaults.linkBaseURL ?? '',
      enableAsciiDoc: options.enableAsciiDoc ?? defaults.enableAsciiDoc ?? true,
      enableMarkdown: options.enableMarkdown ?? defaults.enableMarkdown ?? true,
      enableCodeHighlighting: options.enableCodeHighlighting ?? defaults.enableCodeHighlighting ?? true,
      enableLaTeX: options.enableLaTeX ?? defaults.enableLaTeX ?? true,
      enableMusicalNotation: options.enableMusicalNotation ?? defaults.enableMusicalNotation ?? true,
      enableNostrAddresses: options.enableNostrAddresses ?? defaults.enableNostrAddresses ?? true,
    };
  }

  /**
   * Process Nostr event content and return HTML
   * Automatically detects the content format and processes accordingly
   * Everything is converted to AsciiDoc first, then processed through AsciiDoctor
   */
  async process(content: string): Promise<ProcessResult> {
    // Extract metadata from original content (before conversion)
    const metadata = extractMetadata(content, this.options.linkBaseURL);

    // Detect content format
    const format = detectFormat(content);

    // Convert everything to AsciiDoc format first
    const asciidocContent = convertToAsciidoc(
      content,
      format,
      this.options.linkBaseURL,
      {
        enableNostrAddresses: this.options.enableNostrAddresses,
      }
    );

    // Process through AsciiDoctor
    const result = await processAsciidoc(
      asciidocContent,
      {
        enableCodeHighlighting: this.options.enableCodeHighlighting,
        enableLaTeX: this.options.enableLaTeX,
        enableMusicalNotation: this.options.enableMusicalNotation,
        originalContent: content, // Pass original for LaTeX detection
        linkBaseURL: this.options.linkBaseURL, // Pass linkBaseURL for link processing
      }
    );

    // Combine with extracted metadata
    return {
      ...result,
      nostrLinks: metadata.nostrLinks,
      wikilinks: metadata.wikilinks,
      hashtags: metadata.hashtags,
      links: metadata.links,
      media: metadata.media,
    };
  }
}

/**
 * Convenience function to process content with default options
 */
export async function process(content: string, options?: ParserOptions): Promise<ProcessResult> {
  const parser = new Parser(options);
  return parser.process(content);
}
