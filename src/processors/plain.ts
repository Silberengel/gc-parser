import { ProcessResult } from '../types';

/**
 * Escapes HTML special characters
 */
function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Processes plain text content with basic formatting
 */
export function processPlainText(text: string): ProcessResult {
  // Escape HTML
  let html = escapeHTML(text);

  // Convert line breaks to <br>
  html = html.replace(/\n/g, '<br>\n');

  // Convert double line breaks to paragraphs
  const paragraphs = html.split('<br>\n<br>\n');
  const result: string[] = [];
  
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed) {
      result.push(`<p>${trimmed}</p>`);
    }
  }

  return {
    content: result.join('\n'),
    tableOfContents: '',
    hasLaTeX: false,
    hasMusicalNotation: false,
  };
}
