import asciidoctor from '@asciidoctor/core';
import { ProcessResult } from '../types';
import { rewriteAsciiDocLinks } from './asciidoc-links';
import { extractTOC, sanitizeHTML, processLinks } from './html-utils';

const asciidoctorInstance = asciidoctor();

/**
 * Processes AsciiDoc content to HTML
 */
export async function processAsciiDoc(content: string, linkBaseURL: string): Promise<ProcessResult> {
  // Rewrite links in AsciiDoc content
  const processedContent = rewriteAsciiDocLinks(content, linkBaseURL);

  // Convert AsciiDoc to HTML
  const html = asciidoctorInstance.convert(processedContent, {
    safe: 'safe',
    backend: 'html5',
    doctype: 'article',
    attributes: {
      showtitle: true,
      icons: 'font',
      sectanchors: true,
      sectlinks: true,
      toc: 'left',
      toclevels: 3,
    },
  }) as string;

  // Extract table of contents from HTML
  const { toc, contentWithoutTOC } = extractTOC(html);

  // Sanitize HTML to prevent XSS
  const sanitized = sanitizeHTML(contentWithoutTOC);

  // Process links: make external links open in new tab, local links in same tab
  const processed = processLinks(sanitized, linkBaseURL);

  // Also sanitize and process links in TOC
  const tocSanitized = sanitizeHTML(toc);
  const tocProcessed = processLinks(tocSanitized, linkBaseURL);

  return {
    content: processed,
    tableOfContents: tocProcessed,
    hasLaTeX: false,
    hasMusicalNotation: false,
  };
}
