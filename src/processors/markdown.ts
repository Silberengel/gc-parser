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

  // Convert markdown to HTML
  const html = marked.parse(processedContent) as string;

  return {
    html,
    frontmatter,
    hasLaTeX,
    hasMusicalNotation
  };
}
