"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processMusicalNotation = processMusicalNotation;
/**
 * Processes musical notation in HTML content
 * Wraps musical notation in appropriate HTML for rendering
 */
function processMusicalNotation(html) {
    // First, clean up any corrupted abc-notation divs with very long data-abc attributes
    // These were created by a buggy regex that matched the entire HTML document
    html = html.replace(/<div[^>]*class="[^"]*abc-notation[^"]*"[^>]*data-abc="([^"]{500,})"[^>]*>([\s\S]*?)<\/div>/gi, (match, dataAbc, content) => {
        // This is corrupted - extract just the ABC notation from the beginning
        let decoded = dataAbc
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        // Find the actual ABC notation (starts with X:)
        const abcMatch = decoded.match(/^(X:\s*\d+[\s\S]{0,2000}?)(?:\n[^XTCMALK]|&lt;|<\/|sect|div|pre|code)/);
        if (abcMatch) {
            const cleanAbc = abcMatch[1].trim();
            return `<div class="abc-notation" data-abc="${escapeForAttr(cleanAbc)}">${content}</div>`;
        }
        // If we can't extract clean ABC, remove the div entirely
        return content;
    });
    // Clean up code blocks that contain corrupted abc-notation divs inside them
    // The corrupted structure is: <code><div class="abc-notation" data-abc="...entire HTML...">...</div></code>
    html = html.replace(/<pre[^>]*><code[^>]*class="[^"]*language-abc[^"]*"[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, codeContent) => {
        // Check if codeContent contains an abc-notation div with a very long data-abc attribute (>500 chars = corrupted)
        const longDataAbcMatch = codeContent.match(/<div[^>]*class="[^"]*abc-notation[^"]*"[^>]*data-abc="([^"]{500,})"/i);
        if (longDataAbcMatch) {
            // Extract just the ABC notation from the beginning of the corrupted data-abc value
            let decoded = longDataAbcMatch[1]
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
            // The ABC notation ends where the HTML document starts (</code> or </pre>)
            // Extract everything from X: up to (but not including) &lt;/code&gt; or &lt;/pre&gt;
            const abcMatch = decoded.match(/^(X:\s*\d+[\s\S]*?)(?=&lt;\/code&gt;|&lt;\/pre&gt;)/);
            if (abcMatch) {
                let cleanAbc = abcMatch[1].trim();
                // Remove any trailing HTML entities
                cleanAbc = cleanAbc.replace(/&lt;.*$/, '').trim();
                // Validate it's reasonable ABC notation
                if (cleanAbc.length > 10 && cleanAbc.length < 2000 && cleanAbc.match(/^X:\s*\d+/m)) {
                    // Return clean code block - the processing step will wrap it in abc-notation div
                    return `<pre class="highlightjs hljs"><code class="language-abc hljs" data-lang="abc">${cleanAbc}</code></pre>`;
                }
            }
            // If extraction fails, just remove the corrupted div and return empty code block
            // This prevents the corrupted data from being rendered
            return `<pre class="highlightjs hljs"><code class="language-abc hljs" data-lang="abc"></code></pre>`;
        }
        return match;
    });
    // Process ABC notation blocks - ONLY code blocks explicitly marked with language-abc class
    // These come from: [source,abc], [source, abc], [abc] in AsciiDoc, or ```abc in Markdown
    // We do NOT auto-detect ABC notation - it must be explicitly marked
    html = html.replace(/<pre[^>]*><code[^>]*class="[^"]*language-abc[^"]*"[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, codeContent) => {
        // Skip if already processed or corrupted
        if (codeContent.includes('abc-notation') ||
            codeContent.includes('class="abc-notation"') ||
            codeContent.includes('<div') ||
            codeContent.includes('</div>') ||
            codeContent.length > 5000) {
            return match;
        }
        // Extract ABC content from the code block
        let abcContent = codeContent
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/&#x2F;/g, '/');
        // Remove any HTML tags
        abcContent = abcContent.replace(/<[^>]+>/g, '').trim();
        // Only process if it looks like valid ABC notation (starts with X:)
        // Since this is explicitly marked as ABC, we trust it's ABC notation
        if (abcContent.match(/^X:\s*\d+/m) &&
            abcContent.length < 3000 &&
            !abcContent.includes('</') &&
            !abcContent.includes('<div') &&
            !abcContent.includes('sect') &&
            !abcContent.includes('class=')) {
            // Extract just the ABC notation (stop at first non-ABC line or reasonable limit)
            const lines = abcContent.split('\n');
            const abcLines = [];
            for (const line of lines) {
                if (line.includes('</') || line.includes('<div') || line.includes('sect') || line.includes('class=')) {
                    break;
                }
                if (line.length > 200) {
                    break;
                }
                abcLines.push(line);
                if (abcLines.join('\n').length > 2000) {
                    break;
                }
            }
            const cleanAbc = abcLines.join('\n').trim();
            if (cleanAbc.match(/^X:\s*\d+/m) && cleanAbc.length > 10 && cleanAbc.length < 2000) {
                return `<div class="abc-notation" data-abc="${escapeForAttr(cleanAbc)}">${match}</div>`;
            }
        }
        return match;
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
function escapeForAttr(text) {
    return text
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');
}
