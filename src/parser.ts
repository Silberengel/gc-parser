import { ParserOptions, ProcessResult, ContentFormat, Wikilink } from './types';
import { detectFormat } from './detector';
import { processAsciiDoc } from './processors/asciidoc';
import { processMarkdown } from './processors/markdown';
import { postProcess } from './post-processor';
import { preProcessAsciiDoc, restorePlaceholders } from './pre-processor';

/**
 * Default parser options
 */
export function defaultOptions(): ParserOptions {
  return {
    linkBaseURL: undefined,
    enableAsciiDoc: true,
    enableMarkdown: true,
    enableCodeHighlighting: true,
    enableLaTeX: true,
    enableMusicalNotation: true,
    enableNostrAddresses: true,
    wikilinkUrl: undefined,
    hashtagUrl: undefined
  };
}

/**
 * Main parser for Nostr event content
 * Handles multiple content formats: AsciiDoc, Markdown
 * Post-processes wikilinks, hashtags, and nostr: addresses
 */
export class Parser {
  private options: ParserOptions;

  constructor(options?: ParserOptions) {
    this.options = { ...defaultOptions(), ...options };
  }

  /**
   * Process Nostr event content and return HTML
   * Automatically detects the content format and processes accordingly
   */
  async process(content: string): Promise<ProcessResult> {
    if (!content || content.trim().length === 0) {
      return this.emptyResult();
    }

    // Detect format
    const format = detectFormat(content);

    // Process based on format
    let html: string;
    let tableOfContents = '';
    let hasLaTeX = false;
    let hasMusicalNotation = false;
    let frontmatter: Record<string, any> | undefined;

    let preProcessWikilinks: Wikilink[] = [];
    let preProcessHashtags: string[] = [];
    
    if (format === ContentFormat.AsciiDoc && this.options.enableAsciiDoc !== false) {
      // Pre-process to handle wikilinks and hashtags before AsciiDoc conversion
      const preProcessResult = preProcessAsciiDoc(content, this.options);
      preProcessWikilinks = preProcessResult.wikilinks;
      preProcessHashtags = preProcessResult.hashtags;
      
      const result = processAsciiDoc(preProcessResult.content, this.options);
      
      // Restore wikilinks and hashtags from placeholders
      html = restorePlaceholders(result.html, preProcessResult.wikilinks, preProcessResult.hashtags, this.options);
      
      tableOfContents = result.tableOfContents;
      hasLaTeX = result.hasLaTeX;
      hasMusicalNotation = result.hasMusicalNotation;
    } else if (format === ContentFormat.Markdown && this.options.enableMarkdown !== false) {
      const result = processMarkdown(content, this.options);
      html = result.html;
      frontmatter = result.frontmatter;
      hasLaTeX = result.hasLaTeX;
      hasMusicalNotation = result.hasMusicalNotation;
    } else {
      // Plain text or unknown format - just escape and wrap
      html = `<p>${escapeHtml(content)}</p>`;
    }

    // Post-process for nostr: addresses and handle any remaining processing
    // Note: wikilinks and hashtags are already processed for AsciiDoc
    const postProcessResult = postProcess(html, this.options, format === ContentFormat.AsciiDoc);

    // Extract additional metadata
    const links = extractLinks(postProcessResult.html);
    const media = extractMedia(postProcessResult.html);

    // Merge pre-processed and post-processed wikilinks/hashtags
    const allWikilinks = preProcessWikilinks.length > 0 
      ? preProcessWikilinks 
      : postProcessResult.wikilinks;
    const allHashtags = preProcessHashtags.length > 0
      ? preProcessHashtags
      : postProcessResult.hashtags;

    return {
      content: postProcessResult.html,
      tableOfContents,
      hasLaTeX,
      hasMusicalNotation,
      frontmatter,
      nostrLinks: postProcessResult.nostrLinks,
      wikilinks: allWikilinks,
      hashtags: allHashtags,
      links,
      media
    };
  }

  private emptyResult(): ProcessResult {
    return {
      content: '',
      tableOfContents: '',
      hasLaTeX: false,
      hasMusicalNotation: false,
      nostrLinks: [],
      wikilinks: [],
      hashtags: [],
      links: [],
      media: []
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

/**
 * Extract regular links from HTML
 */
function extractLinks(html: string): Array<{ url: string; text: string; isExternal: boolean }> {
  const links: Array<{ url: string; text: string; isExternal: boolean }> = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2] || url;
    const isExternal = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
    
    // Skip nostr links, wikilinks, and hashtags (already extracted)
    if (url.includes('nostr-') || url.includes('events?d=') || url.includes('data-topic')) {
      continue;
    }
    
    links.push({ url, text, isExternal });
  }
  
  return links;
}

/**
 * Extract media URLs from HTML
 */
function extractMedia(html: string): string[] {
  const media: string[] = [];
  
  // Extract image sources
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    media.push(match[1]);
  }
  
  // Extract video sources
  const videoRegex = /<video[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((match = videoRegex.exec(html)) !== null) {
    media.push(match[1]);
  }
  
  // Extract audio sources
  const audioRegex = /<audio[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((match = audioRegex.exec(html)) !== null) {
    media.push(match[1]);
  }
  
  // Extract source tags
  const sourceRegex = /<source[^>]+src=["']([^"']+)["'][^>]*>/gi;
  while ((match = sourceRegex.exec(html)) !== null) {
    media.push(match[1]);
  }
  
  return media;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
