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
  
  // Process hashtags
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
  
  // Fix spacing issues
  asciidoc = asciidoc.replace(/`([^`\n]+)`\s*\(([^)]+)\)/g, '`$1` ($2)');
  asciidoc = asciidoc.replace(/([a-zA-Z0-9])`([^`\n]+)`([a-zA-Z0-9])/g, '$1 `$2` $3');
  asciidoc = asciidoc.replace(/([a-zA-Z0-9])`([^`\n]+)`\s*\(/g, '$1 `$2` (');
  asciidoc = asciidoc.replace(/\)`([^`\n]+)`([a-zA-Z0-9])/g, ') `$1` $2');
  asciidoc = asciidoc.replace(/([a-zA-Z0-9])\)([a-zA-Z0-9])/g, '$1) $2');
  asciidoc = asciidoc.replace(/([a-zA-Z0-9])==/g, '$1 ==');

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

  // Convert images
  asciidoc = asciidoc.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, 'image::$2[$1,width=100%]');
  asciidoc = asciidoc.replace(/image::([^\[]+)\[([^\]]+),width=100%\]/g, 'image::$1[$2,width=100%]');

  // Convert links
  asciidoc = asciidoc.replace(/\[([^\]]+)\]\(([^)]+)\)/g, 'link:$2[$1]');

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
 * Processes hashtags
 * Converts to hashtag:tag[#tag] format
 */
function processHashtags(content: string): string {
  // Match # followed by word characters, avoiding those in URLs, code blocks, etc.
  return content.replace(/\B#([a-zA-Z0-9_]+)/g, (_match, hashtag) => {
    const normalizedHashtag = hashtag.toLowerCase();
    return `hashtag:${normalizedHashtag}[#${hashtag}]`;
  });
}
