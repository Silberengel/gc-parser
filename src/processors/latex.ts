/**
 * Checks if content contains LaTeX math expressions
 */
export function hasLaTeX(content: string): boolean {
  // Check for inline math: $...$ or \(...\)
  const inlineMathPattern = /\$[^$]+\$|\\\([^)]+\\\)/;
  // Check for block math: $$...$$ or \[...\]
  const blockMathPattern = /\$\$[^$]+\$\$|\\\[[^\]]+\\\]/;

  return inlineMathPattern.test(content) || blockMathPattern.test(content);
}

/**
 * Processes LaTeX math expressions in HTML content
 * Wraps LaTeX expressions in appropriate HTML for rendering with MathJax or KaTeX
 */
export function processLaTeX(html: string): string {
  // Process block math: $$...$$ or \[...\]
  // Convert to <div class="math-block">...</div> for MathJax/KaTeX
  const blockMathPattern = /\$\$([^$]+)\$\$|\\\[([^\]]+)\\\]/gs;
  html = html.replace(blockMathPattern, (match, dollarContent, bracketContent) => {
    const mathContent = (dollarContent || bracketContent || '').trim();
    // Wrap in appropriate tags for MathJax/KaTeX
    return `<div class="math-block">\\[${mathContent}\\]</div>`;
  });

  // Process inline math: $...$ or \(...\)
  // Convert to <span class="math-inline">...</span> for MathJax/KaTeX
  const inlineMathPattern = /\$([^$\n]+)\$|\\\(([^)]+)\\\)/g;
  html = html.replace(inlineMathPattern, (match, dollarContent, bracketContent) => {
    const mathContent = (dollarContent || bracketContent || '').trim();
    // Wrap in appropriate tags for MathJax/KaTeX
    return `<span class="math-inline">\\(${mathContent}\\)</span>`;
  });

  return html;
}
