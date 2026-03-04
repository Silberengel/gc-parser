import asciidoctor from '@asciidoctor/core';
import { ParserOptions } from '../types';
import * as emoji from 'node-emoji';

export interface AsciiDocResult {
  html: string;
  tableOfContents: string;
  hasLaTeX: boolean;
  hasMusicalNotation: boolean;
}

/**
 * Process AsciiDoc content to HTML
 */
export function processAsciiDoc(content: string, options: ParserOptions): AsciiDocResult {
  const hasLaTeX = /\[source,latex\]|`\$\[|`\$\\|`\$\$|`\$\{|\$\$|\$\{|\$[^$]/.test(content);
  const hasMusicalNotation = /\[abc\]|\[source,abc\]/i.test(content);
  
  // Process emojis before AsciiDoc conversion
  const processedContent = emoji.emojify(content);

  const asciidoctorOptions: any = {
    safe: 'unsafe',
    attributes: {
      'showtitle': true,
      'icons': 'font',
      'source-highlighter': options.enableCodeHighlighting !== false ? 'highlight.js' : undefined,
      'highlightjs-theme': 'github',
      'toc': 'left',
      'toclevels': 6,
      'sectanchors': true,
      'sectlinks': true,
      'idprefix': '_',
      'idseparator': '_'
    }
  };

  // Convert to HTML
  const Asciidoctor = asciidoctor();
  const htmlResult = Asciidoctor.convert(processedContent, asciidoctorOptions);
  const html = typeof htmlResult === 'string' ? htmlResult : htmlResult.toString();

  // Extract table of contents if present
  const tocMatch = html.match(/<div id="toc"[^>]*>([\s\S]*?)<\/div>/);
  const tableOfContents = tocMatch ? tocMatch[1] : '';

  // Remove TOC from main content if present
  const contentWithoutToc = html.replace(/<div id="toc"[^>]*>[\s\S]*?<\/div>/, '');

  return {
    html: contentWithoutToc,
    tableOfContents,
    hasLaTeX,
    hasMusicalNotation
  };
}
