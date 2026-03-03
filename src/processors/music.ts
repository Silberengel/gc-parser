/**
 * Processes musical notation in HTML content
 * Wraps musical notation in appropriate HTML for rendering
 */
export function processMusicalNotation(html: string): string {
  // Process ABC notation blocks
  const abcBlockPattern = /(X:\s*\d+[^\n]*\n(?:[^\n]+\n)*)/gs;
  html = html.replace(abcBlockPattern, (match) => {
    const abcContent = match.trim();
    return `<div class="abc-notation" data-abc="${escapeForAttr(abcContent)}">${abcContent}</div>`;
  });

  // Process LilyPond notation blocks
  const lilypondPattern = /(\\relative[^}]+})/gs;
  html = html.replace(lilypondPattern, (match) => {
    const lilypondContent = match.trim();
    return `<div class="lilypond-notation" data-lilypond="${escapeForAttr(lilypondContent)}">${lilypondContent}</div>`;
  });

  // Process inline chord notation: [C], [Am], [F#m7], etc.
  const chordPattern = /\[([A-G][#b]?m?[0-9]?[^\[\]]*)\]/g;
  html = html.replace(chordPattern, (match, chord) => {
    return `<span class="chord" data-chord="${escapeForAttr(chord)}">[${chord}]</span>`;
  });

  // Process MusicXML-like notation
  const musicxmlPattern = /(<music[^>]*>.*?<\/music>)/gs;
  html = html.replace(musicxmlPattern, (match) => {
    const musicxmlContent = match.trim();
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
