import { ParserOptions, ProcessResult, ContentFormat } from './types';
import { processAsciiDoc } from './processors/asciidoc';
import { processMarkdown } from './processors/markdown';
import { processPlainText } from './processors/plain';
import { processNostrAddresses } from './processors/nostr';
import { detectFormat } from './detector';
import { processLaTeX, hasLaTeX } from './processors/latex';
import { processMusicalNotation, hasMusicalNotation } from './processors/music';
import { ensureCodeHighlighting } from './processors/code';

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
   */
  async process(content: string): Promise<ProcessResult> {
    // First, process nostr: addresses (if enabled)
    if (this.options.enableNostrAddresses) {
      content = processNostrAddresses(content, this.options.linkBaseURL);
    }

    // Detect content format
    const format = detectFormat(content);

    let result: ProcessResult;

    switch (format) {
      case ContentFormat.AsciiDoc:
        if (this.options.enableAsciiDoc) {
          result = await processAsciiDoc(content, this.options.linkBaseURL);
        } else if (this.options.enableMarkdown) {
          // Fallback to markdown if AsciiDoc is disabled
          result = await processMarkdown(content, this.options.linkBaseURL);
        } else {
          result = processPlainText(content);
        }
        break;
      case ContentFormat.Markdown:
        if (this.options.enableMarkdown) {
          result = await processMarkdown(content, this.options.linkBaseURL);
        } else {
          // Fallback to plain text
          result = processPlainText(content);
        }
        break;
      default:
        // Plain text or mixed content
        result = processPlainText(content);
    }

    // Post-process: handle LaTeX and musical notation in the HTML
    if (this.options.enableLaTeX) {
      result.hasLaTeX = hasLaTeX(result.content);
      if (result.hasLaTeX) {
        result.content = processLaTeX(result.content);
      }
    }

    if (this.options.enableMusicalNotation) {
      result.hasMusicalNotation = hasMusicalNotation(result.content);
      if (result.hasMusicalNotation) {
        result.content = processMusicalNotation(result.content);
      }
    }

    // Ensure code highlighting is applied if enabled
    if (this.options.enableCodeHighlighting) {
      result.content = ensureCodeHighlighting(result.content);
    }

    return result;
  }
}

/**
 * Convenience function to process content with default options
 */
export async function process(content: string, options?: ParserOptions): Promise<ProcessResult> {
  const parser = new Parser(options);
  return parser.process(content);
}
