import asciidoctor from '@asciidoctor/core';
import { ProcessResult } from '../types';
import { extractTOC, sanitizeHTML, processLinks } from './html-utils';
import { postProcessHtml } from './html-postprocess';

const asciidoctorInstance = asciidoctor();

export interface ProcessOptions {
  enableCodeHighlighting?: boolean;
  enableLaTeX?: boolean;
  enableMusicalNotation?: boolean;
  originalContent?: string; // Original content for LaTeX detection
  linkBaseURL?: string; // Base URL for link processing
}

/**
 * Processes AsciiDoc content to HTML using AsciiDoctor
 * Uses AsciiDoctor's built-in highlight.js and LaTeX support
 */
export async function processAsciidoc(
  content: string,
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  const {
    enableCodeHighlighting = true,
    enableLaTeX = true,
    enableMusicalNotation = true,
  } = options;

  // Check if content starts with level 3+ headers
  // Asciidoctor article doctype requires level 1 (=) or level 2 (==) before level 3 (===)
  // If content starts with level 3+, use book doctype
  const firstHeaderMatch = content.match(/^(={1,6})\s+/m);
  let doctype: 'article' | 'book' = 'article';
  
  if (firstHeaderMatch) {
    const firstHeaderLevel = firstHeaderMatch[1].length;
    if (firstHeaderLevel >= 3) {
      doctype = 'book';
    }
  }

  try {
    const result = asciidoctorInstance.convert(content, {
      safe: 'safe',
      backend: 'html5',
      doctype: doctype,
      attributes: {
        'showtitle': true,
        'sectanchors': true,
        'sectlinks': true,
        'toc': 'left',
        'toclevels': 6,
        'toc-title': 'Table of Contents',
        'source-highlighter': enableCodeHighlighting ? 'highlight.js' : 'none',
        'stem': enableLaTeX ? 'latexmath' : 'none',
        'data-uri': true,
        'imagesdir': '',
        'linkcss': false,
        'stylesheet': '',
        'stylesdir': '',
        'prewrap': true,
        'sectnums': false,
        'sectnumlevels': 6,
        'experimental': true,
        'compat-mode': false,
        'attribute-missing': 'warn',
        'attribute-undefined': 'warn',
        'skip-front-matter': true,
        'source-indent': 0,
        'indent': 0,
        'tabsize': 2,
        'tabwidth': 2,
        'hardbreaks': false,
        'paragraph-rewrite': 'normal',
        'sectids': true,
        'idprefix': '',
        'idseparator': '-',
        'sectidprefix': '',
        'sectidseparator': '-'
      }
    });

    const htmlString = typeof result === 'string' ? result : result.toString();
    
    // Extract table of contents from HTML
    const { toc, contentWithoutTOC } = extractTOC(htmlString);
    
    // Sanitize HTML to prevent XSS
    const sanitized = sanitizeHTML(contentWithoutTOC);
    
    // Post-process HTML: convert macros to HTML, add styling, etc.
    const processed = postProcessHtml(sanitized, {
      enableMusicalNotation,
      linkBaseURL: options.linkBaseURL,
    });
    
    // Process links: add target="_blank" to external links
    const processedWithLinks = options.linkBaseURL 
      ? processLinks(processed, options.linkBaseURL)
      : processed;
    
    // Also process TOC
    const tocSanitized = sanitizeHTML(toc);
    const tocProcessed = postProcessHtml(tocSanitized, {
      enableMusicalNotation: false, // Don't process music in TOC
      linkBaseURL: options.linkBaseURL,
    });
    
    // Process links in TOC as well
    const tocProcessedWithLinks = options.linkBaseURL
      ? processLinks(tocProcessed, options.linkBaseURL)
      : tocProcessed;

    // Check for LaTeX in original content (more reliable than checking HTML)
    const contentToCheck = options.originalContent || content;
    const hasLaTeX = enableLaTeX && hasMathContent(contentToCheck);
    
    // Check for musical notation in processed HTML
    const hasMusicalNotation = enableMusicalNotation && (
      /class="abc-notation"|class="lilypond-notation"|class="chord"|class="musicxml-notation"/.test(processed)
    );

    return {
      content: processedWithLinks,
      tableOfContents: tocProcessedWithLinks,
      hasLaTeX,
      hasMusicalNotation,
      nostrLinks: [], // Will be populated by metadata extraction
      wikilinks: [],
      hashtags: [],
      links: [],
      media: [],
    };
  } catch (error) {
    // Fallback to plain text with error logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Use process.stderr.write for Node.js compatibility instead of console.error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeProcess = (globalThis as any).process;
    if (nodeProcess?.stderr) {
      nodeProcess.stderr.write(`Error processing AsciiDoc: ${errorMessage}\n`);
    }
    
    // Escape HTML in content for safe display
    const escapedContent = sanitizeHTML(content);
    
    return {
      content: `<p>${escapedContent}</p>`,
      tableOfContents: '',
      hasLaTeX: false,
      hasMusicalNotation: false,
      nostrLinks: [],
      wikilinks: [],
      hashtags: [],
      links: [],
      media: [],
    };
  }
}

/**
 * Check if content has LaTeX math
 * Based on jumble's detection pattern
 */
function hasMathContent(content: string): boolean {
  // Check for inline math: $...$ or \(...\)
  const inlineMath = /\$[^$]+\$|\\\([^)]+\\\)/.test(content);
  
  // Check for block math: $$...$$ or \[...\]
  const blockMath = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/.test(content);
  
  return inlineMath || blockMath;
}
