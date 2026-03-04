import { ContentFormat } from './types';

/**
 * Detects the content format based on content patterns
 */
export function detectFormat(content: string): ContentFormat {
  if (!content || content.trim().length === 0) {
    return ContentFormat.Plain;
  }

  const trimmed = content.trim();

  // Check for AsciiDoc indicators
  // - Document title: = Title
  // - Section headers: ==, ===, etc.
  // - AsciiDoc attributes: :attribute: value
  // - AsciiDoc blocks: [source,lang], [abc], [plantuml]
  // - AsciiDoc macros: image::, video::, audio::, link:
  if (
    /^=+\s+/.test(trimmed) ||
    /^:[\w-]+:/.test(trimmed) ||
    /\[source,[\w-]+\]/.test(content) ||
    /\[abc\]/.test(content) ||
    /\[plantuml\]/.test(content) ||
    /image::/.test(content) ||
    /video::/.test(content) ||
    /audio::/.test(content) ||
    /link:/.test(content) ||
    /\[cols=/.test(content) ||
    /\|\|===/.test(content) ||
    /footnote:\[/.test(content) ||
    /\[highlight\]/.test(content) ||
    /\[line-through\]/.test(content) ||
    /\[quote\]/.test(content)
  ) {
    return ContentFormat.AsciiDoc;
  }

  // Check for Markdown indicators
  // - YAML frontmatter: --- at start
  // - Markdown headers: #, ##, etc.
  // - Markdown code blocks: ```lang
  // - Markdown links: [text](url)
  // - Markdown images: ![alt](url)
  if (
    /^---\s*$/.test(trimmed.split('\n')[0]) ||
    /^#{1,6}\s+/.test(trimmed) ||
    /^```[\w-]*/.test(trimmed) ||
    /\[.*?\]\(.*?\)/.test(content) ||
    /!\[.*?\]\(.*?\)/.test(content) ||
    /^\|\s*\|/.test(trimmed) ||
    /^>\s+/.test(trimmed)
  ) {
    return ContentFormat.Markdown;
  }

  return ContentFormat.Unknown;
}
