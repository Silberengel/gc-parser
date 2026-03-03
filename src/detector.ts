import { ContentFormat } from './types';

/**
 * Detects the content format based on content patterns
 */
export function detectFormat(content: string): ContentFormat {
  // Check for AsciiDoc indicators
  const asciidocIndicators = [
    '= ',           // Title
    '== ',          // Section
    '=== ',         // Subsection
    'include::',    // Include directive
    'image::',      // Image block
    '[source',      // Source block
    '----',         // Listing block
    '....',         // Literal block
    '|===',         // Table
    'link:',        // AsciiDoc link format
    'wikilink:',    // Wikilink macro
    'hashtag:',     // Hashtag macro
  ];

  let asciidocScore = 0;
  for (const indicator of asciidocIndicators) {
    if (content.includes(indicator)) {
      asciidocScore++;
    }
  }

  // Check for Wikipedia markup indicators (== Heading == format)
  const wikipediaIndicators = [
    /^==+\s+.+?\s+==+$/m,     // Wikipedia headings: == Heading ==
    /\[\[[^\]]+\]\]/,         // Wikipedia links: [[Page]]
    /''[^']+''/,              // Wikipedia bold: ''text''
    /'[^']+'/,                // Wikipedia italic: 'text'
  ];

  let wikipediaScore = 0;
  for (const indicator of wikipediaIndicators) {
    if (indicator.test(content)) {
      wikipediaScore++;
    }
  }

  // Check for Markdown indicators (more specific patterns to avoid false positives)
  const markdownIndicators = [
    /^#{1,6}\s+/m,           // Heading at start of line
    /```[\s\S]*?```/,        // Code block
    /\*\*[^*]+\*\*/,         // Bold text
    /^[-*+]\s+/m,            // List item at start of line
    /!\[[^\]]*\]\([^)]+\)/,  // Image syntax
    /\[[^\]]+\]\([^)]+\)/,   // Link syntax
  ];

  let markdownScore = 0;
  for (const indicator of markdownIndicators) {
    if (indicator.test(content)) {
      markdownScore++;
    }
  }

  // Determine format based on scores
  // Wikipedia format takes precedence if detected (it's more specific)
  if (wikipediaScore > 0 && wikipediaScore >= 2) {
    return ContentFormat.Wikipedia;
  } else if (asciidocScore > markdownScore && asciidocScore >= 2) {
    return ContentFormat.AsciiDoc;
  } else if (markdownScore > 0) {
    return ContentFormat.Markdown;
  }

  return ContentFormat.Plain;
}
