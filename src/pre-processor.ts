import { ParserOptions, Wikilink } from './types';
import * as emoji from 'node-emoji';

/**
 * Pre-process raw content to handle wikilinks and hashtags before AsciiDoc conversion
 * This prevents AsciiDoc from converting them to anchors or other formats
 */
export interface PreProcessResult {
  content: string;
  wikilinks: Wikilink[];
  hashtags: string[];
}

/**
 * Pre-process content to convert wikilinks and hashtags to placeholders
 * that will be processed after HTML conversion
 */
export function preProcessAsciiDoc(content: string, options: ParserOptions): PreProcessResult {
  let processed = content;
  const wikilinks: Wikilink[] = [];
  const hashtags: string[] = [];

  // Process emojis first
  processed = emoji.emojify(processed);

  // Process wikilinks: [[dtag]] or [[dtag|display]]
  // Replace with a placeholder that AsciiDoc won't touch
  const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
  const wikilinkPlaceholders: Map<string, Wikilink> = new Map();
  let placeholderCounter = 0;

  processed = processed.replace(wikilinkRegex, (match, content) => {
    const parts = content.split('|');
    const dtag = parts[0].trim();
    const display = parts.length > 1 ? parts.slice(1).join('|').trim() : dtag;

    const wikilink: Wikilink = {
      dtag,
      display,
      original: match
    };
    wikilinks.push(wikilink);

    // Use a unique placeholder that won't be processed by AsciiDoc
    // Use angle brackets to avoid AsciiDoc formatting interpretation
    const placeholder = `<WIKILINK_PLACEHOLDER_${placeholderCounter}>`;
    wikilinkPlaceholders.set(placeholder, wikilink);
    placeholderCounter++;

    return placeholder;
  });

  // Process hashtags: #hashtag (but not in code blocks)
  // Mark code blocks first
  const codeBlockMarkers: Array<{ start: number; end: number }> = [];
  const codeBlockRegex = /\[source,[^\]]+\]|\[abc\]|\[plantuml\]|```|`[^`]+`/g;
  let match;
  while ((match = codeBlockRegex.exec(processed)) !== null) {
    // Find the end of the code block
    const start = match.index;
    let end = start + match[0].length;
    
    // For source blocks, find the closing ----
    if (match[0].startsWith('[source')) {
      const afterStart = processed.substring(end);
      const closeMatch = afterStart.match(/^[\s\S]*?----/);
      if (closeMatch) {
        end = start + match[0].length + closeMatch[0].length;
      }
    }
    
    codeBlockMarkers.push({ start, end });
  }

  function isInCodeBlock(index: number): boolean {
    return codeBlockMarkers.some(marker => index >= marker.start && index < marker.end);
  }

  // Process hashtags
  const hashtagPlaceholders: Map<string, string> = new Map();
  let hashtagCounter = 0;
  
  // Match hashtags at start of line, after whitespace, or after > (for blockquotes)
  const hashtagRegex = /(^|\s|>)(#[\w-]+)/gm;
  
  processed = processed.replace(hashtagRegex, (match, prefix, hashtag, offset) => {
    if (isInCodeBlock(offset)) return match;
    
    const topic = hashtag.substring(1);
    if (!hashtags.includes(topic)) {
      hashtags.push(topic);
    }

    // Use angle brackets to avoid AsciiDoc formatting interpretation
    const placeholder = `<HASHTAG_PLACEHOLDER_${hashtagCounter}>`;
    hashtagPlaceholders.set(placeholder, topic);
    hashtagCounter++;

    return `${prefix}${placeholder}`;
  });

  return {
    content: processed,
    wikilinks,
    hashtags
  };
}

/**
 * Restore wikilinks and hashtags from placeholders in HTML
 */
export function restorePlaceholders(
  html: string,
  wikilinks: Wikilink[],
  hashtags: string[],
  options: ParserOptions
): string {
  let processed = html;

  // Restore wikilinks (handle both escaped and unescaped placeholders)
  const wikilinkPlaceholderRegex = /&lt;WIKILINK_PLACEHOLDER_(\d+)&gt;|<WIKILINK_PLACEHOLDER_(\d+)>/g;
  processed = processed.replace(wikilinkPlaceholderRegex, (match, escapedIndex, unescapedIndex) => {
    const index = escapedIndex !== undefined ? parseInt(escapedIndex) : parseInt(unescapedIndex);
    const wikilink = wikilinks[index];
    if (!wikilink) return match;

    let url: string;
    if (typeof options.wikilinkUrl === 'function') {
      url = options.wikilinkUrl(wikilink.dtag);
    } else if (typeof options.wikilinkUrl === 'string') {
      url = options.wikilinkUrl.replace('{dtag}', encodeURIComponent(wikilink.dtag));
    } else {
      url = options.linkBaseURL 
        ? `${options.linkBaseURL}/events?d=${encodeURIComponent(wikilink.dtag)}`
        : `#${encodeURIComponent(wikilink.dtag)}`;
    }

    return `<a href="${escapeHtml(url)}" class="wikilink" data-dtag="${escapeHtml(wikilink.dtag)}">${escapeHtml(wikilink.display)}</a>`;
  });

  // Restore hashtags (handle both escaped and unescaped placeholders)
  const hashtagPlaceholderRegex = /&lt;HASHTAG_PLACEHOLDER_(\d+)&gt;|<HASHTAG_PLACEHOLDER_(\d+)>/g;
  processed = processed.replace(hashtagPlaceholderRegex, (match, escapedIndex, unescapedIndex) => {
    const index = escapedIndex !== undefined ? parseInt(escapedIndex) : parseInt(unescapedIndex);
    const topic = hashtags[index];
    if (!topic) return match;

    let url: string | undefined;
    if (typeof options.hashtagUrl === 'function') {
      url = options.hashtagUrl(topic);
    } else if (typeof options.hashtagUrl === 'string') {
      url = options.hashtagUrl.replace('{topic}', encodeURIComponent(topic));
    }

    const hashtag = `#${topic}`;
    if (url) {
      return `<a href="${escapeHtml(url)}" class="hashtag" data-topic="${escapeHtml(topic)}">${escapeHtml(hashtag)}</a>`;
    } else {
      return `<span class="hashtag" data-topic="${escapeHtml(topic)}">${escapeHtml(hashtag)}</span>`;
    }
  });

  return processed;
}

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
