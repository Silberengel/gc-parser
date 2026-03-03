/**
 * Checks if content contains musical notation
 */
export function hasMusicalNotation(content: string): boolean {
  // Check for ABC notation: X:1, K:C, etc.
  const abcPattern = /X:\s*\d+|K:\s*[A-G]|M:\s*\d+\/\d+/i;
  // Check for LilyPond notation: \relative, \clef, etc.
  const lilypondPattern = /\\relative|\\clef|\\key|\\time/;
  // Check for MusicXML-like tags: <note>, <pitch>, etc.
  const musicxmlPattern = /<note>|<pitch>|<rest>/i;
  // Check for simple chord notation: [C], [Am], etc.
  const chordPattern = /\[[A-G][#b]?m?[0-9]?\]/;

  return abcPattern.test(content) ||
    lilypondPattern.test(content) ||
    musicxmlPattern.test(content) ||
    chordPattern.test(content);
}

/**
 * Processes musical notation in HTML content
 * Wraps musical notation in appropriate HTML for rendering
 */
export function processMusicalNotation(html: string): string {
  // Process ABC notation blocks
  // ABC notation typically starts with X:1 and contains multiple lines
  const abcBlockPattern = /(X:\s*\d+[^\n]*\n(?:[^\n]+\n)*)/gs;
  html = html.replace(abcBlockPattern, (match) => {
    const abcContent = match.trim();
    // Wrap in a div for ABC.js or similar renderer
    return `<div class="abc-notation" data-abc="${escapeForAttr(abcContent)}">${abcContent}</div>`;
  });

  // Process LilyPond notation blocks
  // LilyPond notation is typically in code blocks or between \relative and }
  const lilypondPattern = /(\\relative[^}]+})/gs;
  html = html.replace(lilypondPattern, (match) => {
    const lilypondContent = match.trim();
    // Wrap in a div for LilyPond rendering
    return `<div class="lilypond-notation" data-lilypond="${escapeForAttr(lilypondContent)}">${lilypondContent}</div>`;
  });

  // Process inline chord notation: [C], [Am], [F#m7], etc.
  const chordPattern = /\[([A-G][#b]?m?[0-9]?[^\[\]]*)\]/g;
  html = html.replace(chordPattern, (match, chord) => {
    // Wrap in a span for chord rendering
    return `<span class="chord" data-chord="${escapeForAttr(chord)}">[${chord}]</span>`;
  });

  // Process MusicXML-like notation (if present in content)
  const musicxmlPattern = /(<music[^>]*>.*?<\/music>)/gs;
  html = html.replace(musicxmlPattern, (match) => {
    const musicxmlContent = match.trim();
    // Wrap in a div for MusicXML rendering
    return `<div class="musicxml-notation" data-musicxml="${escapeForAttr(musicxmlContent)}">${musicxmlContent}</div>`;
  });

  return html;
}

/**
 * Escapes a string for use in HTML attributes
 */
function escapeForAttr(text: string): string {
  return text
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}
