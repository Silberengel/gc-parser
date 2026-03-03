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

  // Check for Markdown indicators
  const markdownIndicators = [
    '# ',           // Heading
    '## ',          // Subheading
    '```',          // Code block
    '**',           // Bold
    '*',            // Italic or list
    '- ',           // List item
    '![',           // Image
    '[',            // Link
  ];

  let markdownScore = 0;
  for (const indicator of markdownIndicators) {
    if (content.includes(indicator)) {
      markdownScore++;
    }
  }

  // Determine format based on scores
  if (asciidocScore > markdownScore && asciidocScore >= 2) {
    return ContentFormat.AsciiDoc;
  } else if (markdownScore > 0) {
    return ContentFormat.Markdown;
  }

  return ContentFormat.Plain;
}
