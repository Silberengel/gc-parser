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

  // Preserve nostr: addresses temporarily
  asciidoc = asciidoc.replace(/nostr:([a-z0-9]+)/g, 'nostr:$1');

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

  // Convert code blocks
  asciidoc = asciidoc.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (_match, lang, code) => {
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
 */
function convertPlainTextToAsciidoc(content: string): string {
  return content
    .replace(/\n\n/g, '\n\n')
    .replace(/\n/g, ' +\n');
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
 * Converts to wikilink:dtag[display] format
 */
function processWikilinks(content: string, linkBaseURL: string): string {
  // Process bookstr macro wikilinks: [[book::...]]
  content = content.replace(/\[\[book::([^\]]+)\]\]/g, (_match, bookContent) => {
    const cleanContent = bookContent.trim();
    return `BOOKSTR:${cleanContent}`;
  });

  // Process standard wikilinks: [[Target Page]] or [[target page|see this]]
  content = content.replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_match, target, displayText) => {
    const cleanTarget = target.trim();
    const cleanDisplay = displayText ? displayText.trim() : cleanTarget;
    const dTag = normalizeDtag(cleanTarget);
    
    return `wikilink:${dTag}[${cleanDisplay}]`;
  });

  return content;
}

/**
 * Processes nostr: addresses
 * Converts to link:nostr:...[...] format
 */
function processNostrAddresses(content: string, linkBaseURL: string): string {
  // Match nostr: followed by valid bech32 string
  return content.replace(/nostr:([a-z0-9]+[a-z0-9]{6,})/g, (_match, bech32Id) => {
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
