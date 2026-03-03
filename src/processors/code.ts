import hljs from 'highlight.js';

/**
 * Ensures code blocks have syntax highlighting using highlight.js
 */
export function ensureCodeHighlighting(html: string): string {
  // Pattern to match code blocks: <pre><code>...</code></pre> or <pre><code class="language-xxx">...</code></pre>
  const codeBlockRegex = /<pre><code(?:\s+class=["']language-([^"']+)["'])?[^>]*>(.*?)<\/code><\/pre>/gs;

  return html.replace(codeBlockRegex, (match, lang, code) => {
    // Unescape HTML entities in code
    const unescapedCode = unescapeHTML(code);

    // Highlight the code
    try {
      let highlighted: hljs.HighlightResult;

      if (lang) {
        // Try to get the language
        const language = hljs.getLanguage(lang);
        if (language) {
          highlighted = hljs.highlight(unescapedCode, { language: lang });
        } else {
          // Try auto-detection
          highlighted = hljs.highlightAuto(unescapedCode);
        }
      } else {
        // Auto-detect language
        highlighted = hljs.highlightAuto(unescapedCode);
      }

      // Return highlighted code with proper classes
      const langClass = highlighted.language ? ` class="language-${highlighted.language}"` : '';
      return `<pre><code${langClass}>${highlighted.value}</code></pre>`;
    } catch (error) {
      // If highlighting fails, return original
      return match;
    }
  });
}

/**
 * Unescapes HTML entities
 */
function unescapeHTML(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
