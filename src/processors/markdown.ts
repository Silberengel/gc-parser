import { marked } from 'marked';
import { ProcessResult } from '../types';
import { rewriteMarkdownLinks } from './markdown-links';
import { sanitizeHTML, processLinks } from './html-utils';

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false,
});

/**
 * Processes Markdown content to HTML
 */
export async function processMarkdown(content: string, linkBaseURL: string): Promise<ProcessResult> {
  // Rewrite links in Markdown content
  const processedContent = rewriteMarkdownLinks(content, linkBaseURL);

  // Convert Markdown to HTML
  const html = await marked.parse(processedContent) as string;

  // Sanitize HTML to prevent XSS
  const sanitized = sanitizeHTML(html);

  // Process links: make external links open in new tab, local links in same tab
  const processed = processLinks(sanitized, linkBaseURL);

  return {
    content: processed,
    tableOfContents: '',
    hasLaTeX: false,
    hasMusicalNotation: false,
  };
}
