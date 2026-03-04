import { ContentFormat } from '../types';

export interface ConvertOptions {
  enableNostrAddresses?: boolean;
}

/**
 * Converts content to AsciiDoc format based on detected format
 * This is the unified entry point - everything becomes AsciiDoc
 */
export function convertToAsciidoc(
  content: string,
  format: ContentFormat,
  linkBaseURL: string,
  options: ConvertOptions = {}
): string {
  let asciidoc = '';

  switch (format) {
    case ContentFormat.AsciiDoc:
      // For AsciiDoc content, ensure proper formatting
      asciidoc = content.replace(/\\n/g, '\n');
      
      // Ensure headers are on their own lines with proper spacing
      asciidoc = asciidoc.replace(/(\S[^\n]*)\n(={1,6}\s+[^\n]+)/g, (_match, before, header) => {
        return `${before}\n\n${header}`;
      });
      break;

    case ContentFormat.Wikipedia:
      asciidoc = convertWikipediaToAsciidoc(content);
      break;

    case ContentFormat.Markdown:
      asciidoc = convertMarkdownToAsciidoc(content);
      break;

    case ContentFormat.Plain:
    default:
      asciidoc = convertPlainTextToAsciidoc(content);
      break;
  }

  // Process special elements for all content types
  // Process wikilinks
  asciidoc = processWikilinks(asciidoc, linkBaseURL);
  
  // Process nostr: addresses if enabled
  if (options.enableNostrAddresses !== false) {
    asciidoc = processNostrAddresses(asciidoc, linkBaseURL);
  }
  
  // Process media URLs in markdown links/images first (before converting to AsciiDoc)
  // This ensures media URLs in [text](url) or ![alt](url) format are detected
  asciidoc = processMediaUrlsInMarkdown(asciidoc);
  
  // Process media URLs (YouTube, Spotify, video, audio files) - for bare URLs
  asciidoc = processMediaUrls(asciidoc);
  
  // Process bare URLs (convert to AsciiDoc links)
  asciidoc = processBareUrls(asciidoc);
  
  // Process hashtags (after URLs to avoid conflicts)
  asciidoc = processHashtags(asciidoc);
  
  return asciidoc;
}

/**
 * Converts Wikipedia markup to AsciiDoc format
 * Handles Wikipedia-style headings, links, and formatting
 */
function convertWikipediaToAsciidoc(content: string): string {
  let asciidoc = content.replace(/\\n/g, '\n');
  
  // Convert Wikipedia headings: == Heading == to AsciiDoc == Heading
  // Wikipedia uses == for level 2, === for level 3, etc.
  // AsciiDoc uses = for title, == for level 1, === for level 2, etc.
  // So Wikipedia level 2 (==) maps to AsciiDoc level 1 (==)
  asciidoc = asciidoc.replace(/^(=+)\s+(.+?)\s+\1$/gm, (match, equals, heading) => {
    const level = equals.length - 1; // Count = signs, subtract 1 for AsciiDoc mapping
    const asciidocEquals = '='.repeat(level + 1); // AsciiDoc uses one more = for same level
    return `${asciidocEquals} ${heading.trim()}`;
  });
  
  // Convert Wikipedia bold: ''text'' to AsciiDoc *text*
  asciidoc = asciidoc.replace(/''([^']+)''/g, '*$1*');
  
  // Convert Wikipedia italic: 'text' to AsciiDoc _text_
  // Be careful not to match apostrophes in words
  asciidoc = asciidoc.replace(/(^|[^'])'([^']+)'([^']|$)/g, '$1_$2_$3');
  
  // Convert Wikipedia links: [[Page]] or [[Page|Display]] to wikilinks
  // These will be processed by processWikilinks later, but we need to ensure
  // they're in the right format. Wikipedia links are already in [[...]] format
  // which matches our wikilink format, so they should work as-is.
  
  // Convert Wikipedia external links: [URL text] to AsciiDoc link:URL[text]
  asciidoc = asciidoc.replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, 'link:$1[$2]');
  asciidoc = asciidoc.replace(/\[(https?:\/\/[^\s\]]+)\]/g, 'link:$1[$1]');
  
  // Convert Wikipedia lists (they use * or # similar to Markdown)
  // This is handled similarly to Markdown, so we can reuse that logic
  // But Wikipedia also uses : for definition lists and ; for term lists
  // For now, we'll handle basic lists and let AsciiDoc handle the rest
  
  // Convert horizontal rules: ---- to AsciiDoc '''
  asciidoc = asciidoc.replace(/^----+$/gm, "'''");
  
  return asciidoc;
}

/**
 * Converts Markdown to AsciiDoc format
 * Based on jumble's conversion patterns
 */
function convertMarkdownToAsciidoc(content: string): string {
  let asciidoc = content.replace(/\\n/g, '\n');
  
  // Fix spacing issues (but be careful not to break links and images)
  // Process these BEFORE converting links/images to avoid conflicts
  asciidoc = asciidoc.replace(/`([^`\n]+)`\s*\(([^)]+)\)/g, '`$1` ($2)');
  asciidoc = asciidoc.replace(/([a-zA-Z0-9])`([^`\n]+)`([a-zA-Z0-9])/g, '$1 `$2` $3');
  asciidoc = asciidoc.replace(/([a-zA-Z0-9])`([^`\n]+)`\s*\(/g, '$1 `$2` (');
  asciidoc = asciidoc.replace(/\)`([^`\n]+)`([a-zA-Z0-9])/g, ') `$1` $2');
  asciidoc = asciidoc.replace(/([a-zA-Z0-9])\)([a-zA-Z0-9])/g, '$1) $2');
  // Add space before == but not if it's part of a markdown link pattern
  // Check that == is not immediately after ]( which would be a link
  asciidoc = asciidoc.replace(/([a-zA-Z0-9])(?<!\]\()==/g, '$1 ==');

  // Note: nostr: addresses are processed later in processNostrAddresses

  // Convert headers
  asciidoc = asciidoc.replace(/^#{6}\s+(.+)$/gm, '====== $1 ======');
  asciidoc = asciidoc.replace(/^#{5}\s+(.+)$/gm, '===== $1 =====');
  asciidoc = asciidoc.replace(/^#{4}\s+(.+)$/gm, '==== $1 ====');
  asciidoc = asciidoc.replace(/^#{3}\s+(.+)$/gm, '=== $1 ===');
  asciidoc = asciidoc.replace(/^#{2}\s+(.+)$/gm, '== $1 ==');
  asciidoc = asciidoc.replace(/^#{1}\s+(.+)$/gm, '= $1 =');
  asciidoc = asciidoc.replace(/^==\s+(.+?)\s+==$/gm, '== $1 ==');
  asciidoc = asciidoc.replace(/\s==\s+([^=]+?)\s+==\s/g, ' == $1 == ');

  // Convert emphasis
  asciidoc = asciidoc.replace(/\*\*(.+?)\*\*/g, '*$1*'); // Bold
  asciidoc = asciidoc.replace(/__(.+?)__/g, '*$1*'); // Bold
  asciidoc = asciidoc.replace(/\*(.+?)\*/g, '_$1_'); // Italic
  asciidoc = asciidoc.replace(/_(.+?)_/g, '_$1_'); // Italic
  asciidoc = asciidoc.replace(/~~(.+?)~~/g, '[line-through]#$1#'); // Strikethrough
  asciidoc = asciidoc.replace(/~(.+?)~/g, '[subscript]#$1#'); // Subscript
  asciidoc = asciidoc.replace(/\^(.+?)\^/g, '[superscript]#$1#'); // Superscript

  // Convert code blocks (handle both \n and \r\n line endings)
  asciidoc = asciidoc.replace(/```(\w+)?\r?\n([\s\S]*?)\r?\n```/g, (_match, lang, code) => {
    const trimmedCode = code.trim();
    if (trimmedCode.length === 0) return '';
    
    const hasCodePatterns = /[{}();=<>]|function|class|import|export|def |if |for |while |return |const |let |var |public |private |static |console\.log/.test(trimmedCode);
    const isLikelyText = /^[A-Za-z\s.,!?\-'"]+$/.test(trimmedCode) && trimmedCode.length > 50;
    const hasTooManySpaces = (trimmedCode.match(/\s{3,}/g) || []).length > 3;
    const hasMarkdownPatterns = /^#{1,6}\s|^\*\s|^\d+\.\s|^\>\s|^\|.*\|/.test(trimmedCode);
    
    if ((!hasCodePatterns && trimmedCode.length > 100) || isLikelyText || hasTooManySpaces || hasMarkdownPatterns) {
      return _match;
    }
    
    return `[source${lang ? ',' + lang : ''}]\n----\n${trimmedCode}\n----`;
  });
  asciidoc = asciidoc.replace(/`([^`]+)`/g, '`$1`'); // Inline code
  asciidoc = asciidoc.replace(/`\$([^$]+)\$`/g, '`$\\$1\\$$`'); // Preserve LaTeX in code

  // Convert images first (before links, since images are links with ! prefix)
  // Match: ![alt text](url) or ![](url) - handle empty alt text
  // Use non-greedy matching to stop at first closing paren
  asciidoc = asciidoc.replace(/!\[([^\]]*)\]\(([^)]+?)\)/g, (match, alt, url) => {
    const cleanUrl = url.trim();
    const cleanAlt = alt.trim();
    
    // Check if it's already a MEDIA: placeholder (processed by processMediaUrlsInMarkdown)
    if (cleanUrl.startsWith('MEDIA:')) {
      return cleanUrl; // Return the placeholder as-is
    }
    
    // Regular image - escape special characters in URL for AsciiDoc
    const escapedUrl = cleanUrl.replace(/([\[\]])/g, '\\$1');
    return `image::${escapedUrl}[${cleanAlt ? cleanAlt + ', ' : ''}width=100%]`;
  });

  // Convert links (but not images, which we already processed)
  // Match: [text](url) - use negative lookbehind to avoid matching images
  // Use non-greedy matching for URL to stop at first closing paren
  // This ensures we don't capture trailing punctuation
  asciidoc = asciidoc.replace(/(?<!!)\[([^\]]+)\]\(([^)]+?)\)/g, (match, text, url) => {
    const cleanUrl = url.trim();
    const cleanText = text.trim();
    
    // Check if it's already a MEDIA: placeholder (processed by processMediaUrlsInMarkdown)
    if (cleanUrl.startsWith('MEDIA:')) {
      return cleanUrl; // Return the placeholder as-is
    }
    
    // Regular link - escape special AsciiDoc characters in both URL and text
    const escapedUrl = cleanUrl.replace(/([\[\]])/g, '\\$1');
    const escapedText = cleanText.replace(/([\[\]])/g, '\\$1');
    return `link:${escapedUrl}[${escapedText}]`;
  });

  // Convert horizontal rules
  asciidoc = asciidoc.replace(/^---$/gm, '\'\'\'');

  // Convert unordered lists
  asciidoc = asciidoc.replace(/^(\s*)\*\s+(.+)$/gm, '$1* $2');
  asciidoc = asciidoc.replace(/^(\s*)-\s+(.+)$/gm, '$1* $2');
  asciidoc = asciidoc.replace(/^(\s*)\+\s+(.+)$/gm, '$1* $2');

  // Convert ordered lists
  asciidoc = asciidoc.replace(/^(\s*)\d+\.\s+(.+)$/gm, '$1. $2');

  // Convert blockquotes with attribution
  asciidoc = asciidoc.replace(/^(>\s+.+(?:\n>\s+.+)*)/gm, (match) => {
    const lines = match.split('\n').map(line => line.replace(/^>\s*/, ''));
    
    let quoteBodyLines: string[] = [];
    let attributionLine: string | undefined;
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('—') || line.startsWith('--')) {
        attributionLine = line;
        quoteBodyLines = lines.slice(0, i);
        break;
      }
    }
    
    const quoteContent = quoteBodyLines.filter(l => l.trim() !== '').join('\n').trim();
    
    if (attributionLine) {
      let cleanedAttribution = attributionLine.replace(/^[—-]+/, '').trim();
      
      let author = '';
      let source = '';
      
      const linkMatch = cleanedAttribution.match(/^(.*?),?\s*link:([^[\\]]+)\[([^\\]]+)\]$/);
      
      if (linkMatch) {
        author = linkMatch[1].trim();
        source = `link:${linkMatch[2].trim()}[${linkMatch[3].trim()}]`;
      } else {
        const parts = cleanedAttribution.split(',').map(p => p.trim());
        author = parts[0];
        if (parts.length > 1) {
          source = parts.slice(1).join(', ').trim();
        }
      }
      
      return `[quote, ${author}, ${source}]\n____\n${quoteContent}\n____`;
    } else {
      return `____\n${quoteContent}\n____`;
    }
  });

  // Convert tables
  asciidoc = asciidoc.replace(/(\|.*\|[\r\n]+\|[\s\-\|]*[\r\n]+(\|.*\|[\r\n]+)*)/g, (match) => {
    const lines = match.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return match;
    
    const headerRow = lines[0];
    const separatorRow = lines[1];
    const dataRows = lines.slice(2);
    
    if (!separatorRow.includes('-')) return match;
    
    let tableAsciidoc = '[cols="1,1"]\n|===\n';
    tableAsciidoc += headerRow + '\n';
    dataRows.forEach(row => {
      tableAsciidoc += row + '\n';
    });
    tableAsciidoc += '|===';
    
    return tableAsciidoc;
  });

  // Convert footnotes
  const footnoteDefinitions: { [id: string]: string } = {};
  let tempAsciidoc = asciidoc;

  tempAsciidoc = tempAsciidoc.replace(/^\[\^([^\]]+)\]:\s*([\s\S]*?)(?=\n\[\^|\n---|\n##|\n###|\n####|\n#####|\n######|$)/gm, (_, id, text) => {
    footnoteDefinitions[id] = text.trim();
    return '';
  });

  asciidoc = tempAsciidoc.replace(/\[\^([^\]]+)\]/g, (match, id) => {
    if (footnoteDefinitions[id]) {
      return `footnote:[${footnoteDefinitions[id]}]`;
    }
    return match;
  });

  return asciidoc;
}

/**
 * Converts plain text to AsciiDoc format
 * Preserves line breaks by converting single newlines to line continuations
 */
function convertPlainTextToAsciidoc(content: string): string {
  // Preserve double newlines (paragraph breaks)
  // Convert single newlines to line continuations ( +\n)
  return content
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n\n+/g, '\n\n') // Normalize multiple newlines to double
    .replace(/([^\n])\n([^\n])/g, '$1 +\n$2'); // Single newlines become line continuations
}

/**
 * Normalizes text to d-tag format
 */
function normalizeDtag(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Processes wikilinks: [[target]] or [[target|display text]]
 * Converts to WIKILINK: placeholder format to protect from AsciiDoc processing
 */
function processWikilinks(content: string, linkBaseURL: string): string {
  // Process bookstr macro wikilinks: [[book::...]]
  content = content.replace(/\[\[book::([^\]]+)\]\]/g, (_match, bookContent) => {
    const cleanContent = bookContent.trim();
    return `BOOKSTR:${cleanContent}`;
  });

  // Process standard wikilinks: [[Target Page]] or [[target page|see this]]
  // Use placeholder format to prevent AsciiDoc from processing the brackets
  content = content.replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_match, target, displayText) => {
    const cleanTarget = target.trim();
    const cleanDisplay = displayText ? displayText.trim() : cleanTarget;
    const dTag = normalizeDtag(cleanTarget);
    
    // Use placeholder format: WIKILINK:dtag|display
    // This prevents AsciiDoc from interpreting the brackets
    return `WIKILINK:${dTag}|${cleanDisplay}`;
  });

  return content;
}

/**
 * Processes nostr: addresses
 * Converts to link:nostr:...[...] format
 * Valid bech32 prefixes: npub, nprofile, nevent, naddr, note
 */
function processNostrAddresses(content: string, linkBaseURL: string): string {
  // Match nostr: followed by valid bech32 prefix and identifier
  // Bech32 format: prefix + separator (1) + data (at least 6 chars for valid identifiers)
  const nostrPattern = /nostr:((?:npub|nprofile|nevent|naddr|note)1[a-z0-9]{6,})/gi;
  return content.replace(nostrPattern, (_match, bech32Id) => {
    return `link:nostr:${bech32Id}[${bech32Id}]`;
  });
}

/**
 * Processes media URLs in markdown links and images
 * Converts them to MEDIA: placeholders before markdown conversion
 */
function processMediaUrlsInMarkdown(content: string): string {
  let processed = content;

  // Process YouTube URLs in markdown links: [text](youtube-url)
  processed = processed.replace(/\[([^\]]+)\]\((?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&][^?\s<>"{}|\\^`\[\]()]*)?\)/gi, (_match, text, videoId) => {
    return `MEDIA:youtube:${videoId}`;
  });

  // Process Spotify URLs in markdown links: [text](spotify-url)
  processed = processed.replace(/\[([^\]]+)\]\((?:https?:\/\/)?(?:open\.)?spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)(?:[?&][^?\s<>"{}|\\^`\[\]()]*)?\)/gi, (_match, text, type, id) => {
    return `MEDIA:spotify:${type}:${id}`;
  });

  // Process video files in markdown links/images: [text](video-url) or ![alt](video-url)
  processed = processed.replace(/[!]?\[([^\]]*)\]\((https?:\/\/[^\s<>"{}|\\^`\[\]()]+\.(mp4|webm|ogg|m4v|mov|avi|mkv|flv|wmv))(?:\?[^\s<>"{}|\\^`\[\]()]*)?\)/gi, (_match, altOrText, url) => {
    const cleanUrl = url.replace(/\?.*$/, ''); // Remove query params
    return `MEDIA:video:${cleanUrl}`;
  });

  // Process audio files in markdown links/images: [text](audio-url) or ![alt](audio-url)
  processed = processed.replace(/[!]?\[([^\]]*)\]\((https?:\/\/[^\s<>"{}|\\^`\[\]()]+\.(mp3|m4a|ogg|wav|flac|aac|opus|wma))(?:\?[^\s<>"{}|\\^`\[\]()]*)?\)/gi, (_match, altOrText, url) => {
    const cleanUrl = url.replace(/\?.*$/, ''); // Remove query params
    return `MEDIA:audio:${cleanUrl}`;
  });

  return processed;
}

/**
 * Processes media URLs (YouTube, Spotify, video, audio files) in bare URLs
 * Converts them to placeholders that will be rendered as embeds/players
 */
function processMediaUrls(content: string): string {
  // Process YouTube URLs
  // Match: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/v/
  content = content.replace(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&][^?\s<>"{}|\\^`\[\]()]*)?/gi, (match, videoId) => {
    return `MEDIA:youtube:${videoId}`;
  });

  // Process Spotify URLs
  // Match: open.spotify.com/track/, open.spotify.com/album/, open.spotify.com/playlist/, open.spotify.com/artist/
  content = content.replace(/(?:https?:\/\/)?(?:open\.)?spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)(?:[?&][^?\s<>"{}|\\^`\[\]()]*)?/gi, (match, type, id) => {
    return `MEDIA:spotify:${type}:${id}`;
  });

  // Process video files (mp4, webm, ogg, m4v, mov, avi, etc.)
  content = content.replace(/(?:https?:\/\/[^\s<>"{}|\\^`\[\]()]+)\.(mp4|webm|ogg|m4v|mov|avi|mkv|flv|wmv)(?:\?[^\s<>"{}|\\^`\[\]()]*)?/gi, (match, ext) => {
    const url = match.replace(/\?.*$/, ''); // Remove query params for cleaner URL
    return `MEDIA:video:${url}`;
  });

  // Process audio files (mp3, m4a, ogg, wav, flac, aac, etc.)
  content = content.replace(/(?:https?:\/\/[^\s<>"{}|\\^`\[\]()]+)\.(mp3|m4a|ogg|wav|flac|aac|opus|wma)(?:\?[^\s<>"{}|\\^`\[\]()]*)?/gi, (match, ext) => {
    const url = match.replace(/\?.*$/, ''); // Remove query params for cleaner URL
    return `MEDIA:audio:${url}`;
  });

  return content;
}

/**
 * Processes bare URLs and converts them to AsciiDoc links
 * Matches http://, https://, and www. URLs that aren't already in markdown links
 */
function processBareUrls(content: string): string {
  // Match URLs that aren't already in markdown link format
  // Pattern: http://, https://, or www. followed by valid URL characters
  // Use negative lookbehind to avoid matching URLs inside parentheses (markdown links)
  // Match URLs that are not preceded by ]( (which would be a markdown link)
  const urlPattern = /(?<!\]\()\b(https?:\/\/[^\s<>"{}|\\^`\[\]()]+|www\.[^\s<>"{}|\\^`\[\]()]+)/gi;
  
  return content.replace(urlPattern, (match, url) => {
    // Ensure URL starts with http:// or https://
    let fullUrl = url;
    if (url.startsWith('www.')) {
      fullUrl = 'https://' + url;
    }
    
    // Escape special AsciiDoc characters
    const escapedUrl = fullUrl.replace(/([\[\]])/g, '\\$1');
    return `link:${escapedUrl}[${url}]`;
  });
}

/**
 * Processes hashtags
 * Converts to hashtag:tag[#tag] format
 * Handles hashtags at the beginning of lines to prevent line breaks
 */
function processHashtags(content: string): string {
  // Match # followed by word characters
  // Match at word boundary OR at start of line OR after whitespace
  // This ensures we don't match # in URLs or code, but do match at line start
  return content.replace(/(^|\s|>)#([a-zA-Z0-9_]+)(?![a-zA-Z0-9_])/g, (match, before, hashtag) => {
    const normalizedHashtag = hashtag.toLowerCase();
    // Preserve the space or line start before the hashtag to prevent line breaks
    // Add a zero-width space or ensure proper spacing
    const prefix = before === '' ? '' : before;
    return `${prefix}hashtag:${normalizedHashtag}[#${hashtag}]`;
  });
}
