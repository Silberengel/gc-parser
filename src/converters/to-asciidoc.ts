import { ContentFormat } from '../types';

// Import node-emoji if available (optional dependency)
let emoji: any;
try {
  emoji = require('node-emoji');
} catch (e) {
  // node-emoji not available, emoji conversion will be skipped
  emoji = null;
}

/**
 * Clean URL by removing tracking parameters
 * Based on jumble's cleanUrl function
 */
function cleanUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    
    // List of tracking parameter prefixes and exact names to remove
    const trackingParams = [
      // Google Analytics & Ads
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
      'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
      
      // Facebook
      'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
      
      // Twitter/X
      'twclid', 'twsrc',
      
      // Microsoft/Bing
      'msclkid', 'mc_cid', 'mc_eid',
      
      // Adobe
      'adobe_mc', 'adobe_mc_ref', 'adobe_mc_sdid',
      
      // Mailchimp
      'mc_cid', 'mc_eid',
      
      // HubSpot
      'hsCtaTracking', 'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_tgt', 'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver',
      
      // Marketo
      'mkt_tok',
      
      // YouTube
      'si', 'feature', 'kw', 'pp',
      
      // Other common tracking
      'ref', 'referrer', 'source', 'campaign', 'medium', 'content',
      'yclid', 'srsltid', '_ga', '_gl', 'igshid', 'epik', 'pk_campaign', 'pk_kwd',
      
      // Mobile app tracking
      'adjust_tracker', 'adjust_campaign', 'adjust_adgroup', 'adjust_creative',
      
      // Amazon
      'tag', 'linkCode', 'creative', 'creativeASIN', 'linkId', 'ascsubtag',
      
      // Affiliate tracking
      'aff_id', 'affiliate_id', 'aff', 'ref_', 'refer',
      
      // Social media share tracking
      'share', 'shared', 'sharesource'
    ];
    
    // Remove all tracking parameters
    trackingParams.forEach(param => {
      parsedUrl.searchParams.delete(param);
    });
    
    // Remove any parameter that starts with utm_ or _
    Array.from(parsedUrl.searchParams.keys()).forEach(key => {
      if (key.startsWith('utm_') || key.startsWith('_')) {
        parsedUrl.searchParams.delete(key);
      }
    });
    
    return parsedUrl.toString();
  } catch {
    // If URL parsing fails, return original URL
    return url;
  }
}

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
  asciidoc = asciidoc.replace(/==(.+?)==/g, '[highlight]#$1#'); // Text highlighting (GFM)
  asciidoc = asciidoc.replace(/~(.+?)~/g, '[subscript]#$1#'); // Subscript
  asciidoc = asciidoc.replace(/\^(.+?)\^/g, '[superscript]#$1#'); // Superscript

  // Convert emoji shortcodes to Unicode (e.g., :tent: -> 🏕️)
  // Only convert if node-emoji is available
  if (emoji && emoji.emojify) {
    asciidoc = emoji.emojify(asciidoc);
  }

  // Convert code blocks (handle both \n and \r\n line endings)
  // Special handling for diagram languages: latex, plantuml, puml, bpmn
  asciidoc = asciidoc.replace(/```(\w+)?\r?\n([\s\S]*?)\r?\n```/g, (_match, lang, code) => {
    const trimmedCode = code.trim();
    if (trimmedCode.length === 0) return '';
    
    const langLower = lang ? lang.toLowerCase() : '';
    
    // If it's a latex code block, always treat as code (not math)
    if (langLower === 'latex') {
      return `[source,latex]\n----\n${trimmedCode}\n----`;
    }
    
    // Handle PlantUML diagrams
    if (langLower === 'plantuml' || langLower === 'puml') {
      // Check if it already has @startuml/@enduml or @startbpmn/@endbpmn
      if (trimmedCode.includes('@start') || trimmedCode.includes('@end')) {
        return `[plantuml]\n----\n${trimmedCode}\n----`;
      }
      // If not, wrap it in @startuml/@enduml
      return `[plantuml]\n----\n@startuml\n${trimmedCode}\n@enduml\n----`;
    }
    
    // Handle BPMN diagrams (using PlantUML BPMN syntax)
    if (langLower === 'bpmn') {
      // Check if it already has @startbpmn/@endbpmn
      if (trimmedCode.includes('@startbpmn') && trimmedCode.includes('@endbpmn')) {
        return `[plantuml]\n----\n${trimmedCode}\n----`;
      }
      // If not, wrap it in @startbpmn/@endbpmn
      return `[plantuml]\n----\n@startbpmn\n${trimmedCode}\n@endbpmn\n----`;
    }
    
    // Check if it's ABC notation (starts with X:)
    if (!lang && /^X:\s*\d+/m.test(trimmedCode)) {
      // ABC notation - keep as plain text block, will be processed by music processor
      return `----\n${trimmedCode}\n----`;
    }
    
    const hasCodePatterns = /[{}();=<>]|function|class|import|export|def |if |for |while |return |const |let |var |public |private |static |console\.log/.test(trimmedCode);
    const isLikelyText = /^[A-Za-z\s.,!?\-'"]+$/.test(trimmedCode) && trimmedCode.length > 50;
    const hasTooManySpaces = (trimmedCode.match(/\s{3,}/g) || []).length > 3;
    const hasMarkdownPatterns = /^#{1,6}\s|^\*\s|^\d+\.\s|^\>\s|^\|.*\|/.test(trimmedCode);
    
    if ((!hasCodePatterns && trimmedCode.length > 100) || isLikelyText || hasTooManySpaces || hasMarkdownPatterns) {
      return _match;
    }
    
    return `[source${lang ? ',' + lang : ''}]\n----\n${trimmedCode}\n----`;
  });
  
  // Handle inline code: LaTeX formulas in inline code should be rendered as math
  // Pattern: `$formula$` should become $formula$ (math), not code
  // Handle escaped brackets: `$[ ... \]$` and `$[\sqrt{...}\]$`
  asciidoc = asciidoc.replace(/`(\$[^`]+\$)`/g, (match, formula) => {
    // Extract the formula (remove the $ signs)
    const mathContent = formula.slice(1, -1);
    return `$${mathContent}$`; // Return as math, not code
  });
  asciidoc = asciidoc.replace(/`([^`]+)`/g, '`$1`'); // Regular inline code

  // Convert nested image links first: [![alt](img)](url) - image wrapped in link
  // This must come before regular image processing
  asciidoc = asciidoc.replace(/\[!\[([^\]]*)\]\(([^)]+?)\)\]\(([^)]+?)\)/g, (match, alt, imgUrl, linkUrl) => {
    const cleanImgUrl = imgUrl.trim();
    const cleanLinkUrl = linkUrl.trim();
    const cleanAlt = alt.trim();
    
    // Check if linkUrl is a media URL
    if (cleanLinkUrl.startsWith('MEDIA:')) {
      return cleanLinkUrl; // Return the placeholder as-is
    }
    
    // Create a link with an image inside - don't escape brackets in URLs
    // AsciiDoc can handle URLs with brackets if they're in the URL part
    return `link:${cleanLinkUrl}[image:${cleanImgUrl}[${cleanAlt ? cleanAlt : 'link'}]]`;
  });

  // Convert images (but not nested ones, which we already processed)
  // Match: ![alt text](url) or ![](url) - handle empty alt text
  // Use negative lookbehind to avoid matching nested image links
  // Format: image::url[alt,width=100%] - matching jumble's format
  asciidoc = asciidoc.replace(/(?<!\[)!\[([^\]]*)\]\(([^)]+?)\)/g, (match, alt, url) => {
    let processedUrl = url.trim();
    const cleanAlt = alt.trim();
    
    // Check if it's already a MEDIA: placeholder (processed by processMediaUrlsInMarkdown)
    if (processedUrl.startsWith('MEDIA:')) {
      return processedUrl; // Return the placeholder as-is
    }
    
    // Clean URL (remove tracking parameters)
    processedUrl = cleanUrl(processedUrl);
    
    // Regular image - match jumble's format: image::url[alt,width=100%]
    // Don't escape brackets - AsciiDoc handles URLs properly
    return `image::${processedUrl}[${cleanAlt ? cleanAlt + ',' : ''}width=100%]`;
  });

  // Convert anchor links: [text](#section-id) - these are internal links
  asciidoc = asciidoc.replace(/(?<!!)\[([^\]]+)\]\(#([^)]+)\)/g, (match, text, anchor) => {
    const cleanText = text.trim();
    const cleanAnchor = anchor.trim();
    // AsciiDoc uses # for anchor links, but we need to normalize the anchor ID
    // Convert to lowercase and replace spaces/special chars with hyphens
    const normalizedAnchor = cleanAnchor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const escapedText = cleanText.replace(/([\[\]])/g, '\\$1');
    return `<<${normalizedAnchor},${escapedText}>>`;
  });

  // Convert links (but not images or anchor links, which we already processed)
  // Match: [text](url) - use negative lookbehind to avoid matching images
  // Use non-greedy matching for URL to stop at first closing paren
  // This ensures we don't capture trailing punctuation
  asciidoc = asciidoc.replace(/(?<!!)\[([^\]]+)\]\(([^)]+?)\)/g, (match, text, url) => {
    let processedUrl = url.trim();
    const cleanText = text.trim();
    
    // Check if it's already a MEDIA: placeholder (processed by processMediaUrlsInMarkdown)
    if (processedUrl.startsWith('MEDIA:')) {
      return processedUrl; // Return the placeholder as-is
    }
    
    // Clean URL (remove tracking parameters)
    processedUrl = cleanUrl(processedUrl);
    
    // Handle WSS URLs: convert wss:// to https:// for display
    if (processedUrl.startsWith('wss://')) {
      processedUrl = processedUrl.replace(/^wss:\/\//, 'https://');
    }
    
    // Regular link - don't escape brackets in URLs (AsciiDoc handles them)
    // Only escape brackets in the link text if needed
    const escapedText = cleanText.replace(/([\[\]])/g, '\\$1');
    return `link:${processedUrl}[${escapedText}]`;
  });

  // Convert horizontal rules
  asciidoc = asciidoc.replace(/^---$/gm, '\'\'\'');
  asciidoc = asciidoc.replace(/^\*\*\*$/gm, '\'\'\''); // Also handle ***

  // Convert lists - need to process them as blocks to preserve structure
  // First, convert task lists (before regular lists)
  // Task lists: - [x] or - [ ] or * [x] or * [ ]
  asciidoc = asciidoc.replace(/^(\s*)([-*])\s+\[([ x])\]\s+(.+)$/gm, (_match, indent, bullet, checked, text) => {
    // Use AsciiDoc checkbox syntax: * [x] Task text
    // The checkbox will be rendered by AsciiDoctor
    return `${indent}* [${checked === 'x' ? 'x' : ' '}] ${text}`;
  });

  // Convert lists - process entire list blocks to ensure proper AsciiDoc formatting
  // AsciiDoc lists need to be on their own lines with proper spacing
  // Process lists in blocks to handle nested lists correctly
  const lines = asciidoc.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  let listType: 'unordered' | 'ordered' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isEmpty = line.trim() === '';
    const prevLine = i > 0 ? processedLines[processedLines.length - 1] : '';
    const prevLineIsEmpty = prevLine.trim() === '';
    
    // Check if this line is a list item (but not a task list, which we already processed)
    const unorderedMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    const isTaskList = line.match(/^(\s*)([-*])\s+\[([ x])\]\s+(.+)$/);
    
    if (unorderedMatch && !isTaskList) {
      const [, indent, , text] = unorderedMatch;
      const indentLevel = indent.length;
      // AsciiDoc uses 4 spaces per indentation level
      // Markdown typically uses 2 or 4 spaces per level
      // 2 spaces = 1 level (4 spaces), 4 spaces = 1 level (4 spaces)
      const asciidocIndent = '    '.repeat(Math.ceil(indentLevel / 4));
      
      // Add blank line before list if not already in a list
      // But don't add blank line if we're switching list types within the same list context
      if (!inList) {
        // Starting a new list - add blank line if previous line has content
        if (processedLines.length > 0 && !prevLineIsEmpty) {
          processedLines.push('');
        }
        inList = true;
        listType = 'unordered';
      } else if (listType !== 'unordered') {
        // Switching list types - don't add blank line, just change type
        listType = 'unordered';
      }
      
      processedLines.push(`${asciidocIndent}* ${text}`);
    } else if (orderedMatch) {
      const [, indent, , text] = orderedMatch;
      const indentLevel = indent.length;
      // AsciiDoc uses 4 spaces per indentation level
      // Markdown typically uses 2 or 4 spaces per level
      // 2 spaces = 1 level (4 spaces), 4 spaces = 1 level (4 spaces)
      const asciidocIndent = '    '.repeat(Math.ceil(indentLevel / 4));
      
      // Add blank line before list if not already in a list
      // But don't add blank line if we're switching list types within the same list context
      if (!inList) {
        // Starting a new list - add blank line if previous line has content
        if (processedLines.length > 0 && !prevLineIsEmpty) {
          processedLines.push('');
        }
        inList = true;
        listType = 'ordered';
      } else if (listType !== 'ordered') {
        // Switching list types - don't add blank line, just change type
        listType = 'ordered';
      }
      
      processedLines.push(`${asciidocIndent}. ${text}`);
    } else {
      // Not a list item
      if (inList && !isEmpty) {
        // End of list - add blank line after if the next line is not empty
        if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
          processedLines.push('');
        }
        inList = false;
        listType = null;
      }
      processedLines.push(line);
    }
  }
  
  asciidoc = processedLines.join('\n');

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

  // Convert tables with alignment support
  asciidoc = asciidoc.replace(/(\|.*\|[\r\n]+\|[\s\-\|:]*[\r\n]+(\|.*\|[\r\n]+)*)/g, (match) => {
    const lines = match.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return match;
    
    const headerRow = lines[0];
    const separatorRow = lines[1];
    const dataRows = lines.slice(2);
    
    if (!separatorRow.includes('-')) return match;
    
    // Parse alignment from separator row
    // :--- = left, :----: = center, ---: = right, --- = default
    const cells = separatorRow.split('|').filter(c => c.trim());
    const alignments: string[] = [];
    
    cells.forEach((cell, index) => {
      const trimmed = cell.trim();
      if (trimmed.startsWith(':') && trimmed.endsWith(':')) {
        alignments[index] = '^'; // center (AsciiDoc uses ^ for center)
      } else if (trimmed.endsWith(':')) {
        alignments[index] = '>'; // right
      } else if (trimmed.startsWith(':')) {
        alignments[index] = '<'; // left (explicit)
      } else {
        alignments[index] = '<'; // default left
      }
    });
    
    // Build cols attribute with alignments
    const colsAttr = alignments.length > 0 
      ? `[cols="${alignments.join(',')}"]`
      : '';
    
    let tableAsciidoc = colsAttr ? `${colsAttr}\n` : '';
    tableAsciidoc += '|===\n';
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
 * Only processes addresses with "nostr:" prefix - bare addresses are left as plaintext
 * Converts to link:nostr:...[...] format
 * Valid bech32 prefixes: npub, nprofile, nevent, naddr, note
 */
function processNostrAddresses(content: string, linkBaseURL: string): string {
  // Match nostr: followed by valid bech32 prefix and identifier
  // Bech32 format: prefix + separator (1) + data (at least 6 chars for valid identifiers)
  // Only match if it has "nostr:" prefix - bare addresses should remain as plaintext
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
 * Matches http://, https://, wss://, and www. URLs that aren't already in markdown links
 * Also handles bare image URLs (converts to images)
 * Skips URLs inside code blocks (---- blocks) and inline code (backticks)
 */
function processBareUrls(content: string): string {
  // Protect code blocks and inline code from URL processing
  // We'll process URLs, then restore code blocks
  const codeBlockPlaceholders: string[] = [];
  const inlineCodePlaceholders: string[] = [];
  
  // Replace code blocks with placeholders
  content = content.replace(/\[source[^\]]*\]\n----\n([\s\S]*?)\n----/g, (match, code) => {
    const placeholder = `__CODEBLOCK_${codeBlockPlaceholders.length}__`;
    codeBlockPlaceholders.push(match);
    return placeholder;
  });
  
  // Also handle plain code blocks (without [source])
  content = content.replace(/----\n([\s\S]*?)\n----/g, (match, code) => {
    // Check if this is already a placeholder
    if (match.includes('__CODEBLOCK_')) {
      return match;
    }
    const placeholder = `__CODEBLOCK_${codeBlockPlaceholders.length}__`;
    codeBlockPlaceholders.push(match);
    return placeholder;
  });
  
  // Replace inline code with placeholders
  content = content.replace(/`([^`]+)`/g, (match, code) => {
    const placeholder = `__INLINECODE_${inlineCodePlaceholders.length}__`;
    inlineCodePlaceholders.push(match);
    return placeholder;
  });
  
  // First, handle bare image URLs (before regular URLs)
  // Match image URLs: .jpg, .png, .gif, .webp, .svg, etc.
  // Format: image::url[width=100%] - matching jumble's format
  const imageUrlPattern = /(?<!\]\()\b(https?:\/\/[^\s<>"{}|\\^`\[\]()]+\.(jpe?g|png|gif|webp|svg|bmp|ico))(?:\?[^\s<>"{}|\\^`\[\]()]*)?/gi;
  content = content.replace(imageUrlPattern, (match, url) => {
    // Clean URL (remove tracking parameters)
    const cleanedUrl = cleanUrl(url);
    // Don't escape brackets - AsciiDoc handles URLs properly
    return `image::${cleanedUrl}[width=100%]`;
  });
  
  // Match URLs that aren't already in markdown link format
  // Pattern: http://, https://, wss://, or www. followed by valid URL characters
  // Use word boundary to avoid matching URLs that are part of other text
  // Don't match if immediately after colon-space (like "hyperlink: www.example.com")
  const urlPattern = /(?<!\]\()(?<!:\s)\b(https?:\/\/[^\s<>"{}|\\^`\[\]()]+|wss:\/\/[^\s<>"{}|\\^`\[\]()]+|www\.[^\s<>"{}|\\^`\[\]()]+)/gi;
  
  content = content.replace(urlPattern, (match, url) => {
    // Skip if this URL was already converted to an image
    if (match.includes('image::')) {
      return match;
    }
    
    // Ensure URL starts with http:// or https://
    let fullUrl = url;
    if (url.startsWith('www.')) {
      fullUrl = 'https://' + url;
    } else if (url.startsWith('wss://')) {
      // Convert wss:// to https:// for display
      fullUrl = url.replace(/^wss:\/\//, 'https://');
    }
    
    // Clean URL (remove tracking parameters)
    fullUrl = cleanUrl(fullUrl);
    
    // Don't escape brackets in URLs - AsciiDoc handles them properly
    // The URL is in the link: part, brackets in URLs are valid
    // Use proper AsciiDoc link syntax: link:url[text]
    return `link:${fullUrl}[${url}]`;
  });
  
  // Restore inline code
  inlineCodePlaceholders.forEach((code, index) => {
    content = content.replace(`__INLINECODE_${index}__`, code);
  });
  
  // Restore code blocks
  codeBlockPlaceholders.forEach((code, index) => {
    content = content.replace(`__CODEBLOCK_${index}__`, code);
  });
  
  return content;
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
