import { marked } from 'marked';
// @ts-ignore - marked is ESM but we need it to work in Jest
import { ParserOptions } from '../types';
import * as emoji from 'node-emoji';

export interface MarkdownResult {
  html: string;
  frontmatter?: Record<string, any>;
  hasLaTeX: boolean;
  hasMusicalNotation: boolean;
}

/**
 * Extract YAML frontmatter from markdown content
 */
function extractFrontmatter(content: string): { frontmatter?: Record<string, any>; content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { content };
  }

  try {
    // Simple YAML parser for basic key-value pairs
    const yamlContent = match[1];
    const frontmatter: Record<string, any> = {};
    const lines = yamlContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Handle arrays (simple case)
      if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.slice(1, -1);
        frontmatter[key] = arrayContent.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      } else {
        frontmatter[key] = value;
      }
    }
    
    return {
      frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : undefined,
      content: content.substring(match[0].length)
    };
  } catch (e) {
    return { content };
  }
}

/**
 * Process Markdown content to HTML (minimal markdown support)
 */
export function processMarkdown(content: string, options: ParserOptions): MarkdownResult {
  // Extract frontmatter
  const { frontmatter, content: contentWithoutFrontmatter } = extractFrontmatter(content);

  // Detect LaTeX and musical notation
  const hasLaTeX = /```latex|`\$\[|`\$\\|`\$\$|`\$\{|\$\$|\$\{|\$[^$]/.test(content);
  const hasMusicalNotation = /```abc|```music/i.test(content);

  // Configure marked for minimal markdown
  marked.setOptions({
    gfm: true,
    breaks: false
  });

  // Process emoji shortcodes before markdown processing
  let processedContent = emoji.emojify(contentWithoutFrontmatter);

  // Extract and process footnotes before markdown parsing
  // Footnotes format: [^1] in text and [^1]: definition at end
  const footnoteDefinitions: Map<string, string> = new Map();
  let placeholderCounter = 0;
  
  // First, extract footnote definitions
  const lines = processedContent.split('\n');
  const processedLines: string[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    const footnoteDefMatch = line.match(/^\[\^([^\]]+)\]:\s*(.*)$/);
    if (footnoteDefMatch) {
      const id = footnoteDefMatch[1];
      let definition = footnoteDefMatch[2];
      
      // Collect multi-line definition (until next definition or blank line)
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        if (nextLine.match(/^\[\^[^\]]+\]:/) || (nextLine.trim() === '' && i + 1 < lines.length && lines[i + 1].trim() !== '' && !lines[i + 1].match(/^\[\^[^\]]+\]:/))) {
          break;
        }
        if (nextLine.trim() === '' && i + 1 < lines.length && lines[i + 1].match(/^\[\^[^\]]+\]:/)) {
          break;
        }
        definition += '\n' + nextLine;
        i++;
      }
      
      footnoteDefinitions.set(id, definition.trim());
      // Skip adding this line to processedLines (removing the definition)
      continue;
    }
    
    processedLines.push(line);
    i++;
  }
  
  processedContent = processedLines.join('\n');
  
  // Now replace footnote references with placeholders before markdown parsing
  // Use HTML-like placeholder that markdown will pass through as-is
  const footnoteRefRegex = /\[\^([^\]]+)\]/g;
  let refMatch;
  while ((refMatch = footnoteRefRegex.exec(processedContent)) !== null) {
    const id = refMatch[1];
    if (footnoteDefinitions.has(id)) {
      const placeholder = `<span data-footnote-placeholder="${placeholderCounter++}" data-footnote-id="${id}"></span>`;
      processedContent = processedContent.substring(0, refMatch.index) + 
                        placeholder + 
                        processedContent.substring(refMatch.index + refMatch[0].length);
      // Reset regex since we modified the string
      footnoteRefRegex.lastIndex = 0;
    }
  }

  // Convert markdown to HTML
  let html = marked.parse(processedContent) as string;

  // Process superscripts in HTML (X^2^ syntax) - after markdown parsing to avoid conflicts
  // But skip inside code blocks
  const codeBlockRegex = /<(pre|code)[^>]*>[\s\S]*?<\/\1>/gi;
  const codeBlocks: Array<{ start: number; end: number; content: string }> = [];
  let codeMatch;
  while ((codeMatch = codeBlockRegex.exec(html)) !== null) {
    codeBlocks.push({
      start: codeMatch.index,
      end: codeMatch.index + codeMatch[0].length,
      content: codeMatch[0]
    });
  }
  
  function isInCodeBlock(index: number): boolean {
    return codeBlocks.some(block => index >= block.start && index < block.end);
  }
  
  // Process superscripts
  const superscriptRegex = /\^([^\^<>\n]+)\^/g;
  const superscriptReplacements: Array<{ match: string; replacement: string; index: number }> = [];
  let supMatch;
  while ((supMatch = superscriptRegex.exec(html)) !== null) {
    if (isInCodeBlock(supMatch.index)) continue;
    superscriptReplacements.push({
      match: supMatch[0],
      replacement: `<sup>${supMatch[1]}</sup>`,
      index: supMatch.index
    });
  }
  
  // Apply superscript replacements in reverse order
  superscriptReplacements.reverse().forEach(({ match, replacement, index }) => {
    html = html.substring(0, index) + replacement + html.substring(index + match.length);
  });

  // Replace footnote placeholders with actual footnote HTML
  let footnoteCounter = 1;
  const footnoteRefs: Array<{ id: string; num: number; definition: string }> = [];
  const footnoteRefMap: Map<string, number> = new Map();
  
  // First, assign numbers to all footnote definitions
  footnoteDefinitions.forEach((definition, id) => {
    const num = footnoteCounter++;
    footnoteRefMap.set(id, num);
    footnoteRefs.push({ id, num, definition });
  });
  
  // Replace HTML span placeholders with footnote HTML
  // Find all span elements with data-footnote-placeholder attribute
  const placeholderRegex = /<span data-footnote-placeholder="(\d+)" data-footnote-id="([^"]+)"><\/span>/g;
  html = html.replace(placeholderRegex, (match, placeholderNum, id) => {
    const num = footnoteRefMap.get(id);
    if (num !== undefined) {
      return `<sup class="footnote"><a id="footnoteref_${num}" class="footnote" href="#footnotedef_${num}" title="View footnote.">${num}</a></sup>`;
    }
    return match; // Return original if no definition found
  });

  // Add footnotes section at the end if there are any
  if (footnoteRefs.length > 0) {
    let footnotesHtml = '<div id="footnotes"><hr>';
    footnoteRefs.forEach(({ id, num, definition }) => {
      // Process the definition through markdown again to handle formatting
      const defHtml = marked.parse(definition) as string;
      footnotesHtml += `<div class="footnote" id="footnotedef_${num}"><a href="#footnoteref_${num}">${num}</a>. ${defHtml}</div>`;
    });
    footnotesHtml += '</div>';
    html += footnotesHtml;
  }
  
  // Fix anchor links - markdown headers need IDs
  // Marked generates headers but may not have proper IDs for anchor links
  // Process headers to add IDs based on their text content (if they don't already have one)
  html = html.replace(/<h([1-6])([^>]*)>([^<]+)<\/h[1-6]>/gi, (match: string, level: string, attrs: string, text: string) => {
    // Skip if header already has an id attribute
    if (attrs && /id=["'][^"']+["']/i.test(attrs)) {
      return match;
    }
    
    // Generate ID from header text (similar to GitHub markdown)
    const id = text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    // Add id attribute
    const newAttrs = attrs ? `${attrs} id="${id}"` : `id="${id}"`;
    return `<h${level} ${newAttrs}>${text}</h${level}>`;
  });

  return {
    html,
    frontmatter,
    hasLaTeX,
    hasMusicalNotation
  };
}
