# GC Parser

A super-parser for Nostr event content that handles multiple content formats including AsciiDoc, Markdown, code syntax highlighting, LaTeX, musical notation, and `nostr:` prefixed addresses.

Built with TypeScript/JavaScript using:
- **asciidoctor.js** for AsciiDoc processing
- **marked** for Markdown processing
- **highlight.js** for code syntax highlighting

## Features

- **AsciiDoc Processing**: Full AsciiDoc to HTML conversion with table of contents support
- **Markdown Processing**: Markdown to HTML conversion with GFM support
- **Code Syntax Highlighting**: Automatic syntax highlighting for code blocks using highlight.js
- **LaTeX Math**: Support for inline and block LaTeX math expressions (compatible with MathJax/KaTeX)
- **Musical Notation**: Support for ABC notation, LilyPond, chord notation, and MusicXML
- **Nostr Addresses**: Automatic processing of `nostr:` prefixed addresses (naddr, nevent, note, npub, nprofile)
- **Link Rewriting**: Automatic rewriting of wikilinks and nostr addresses to proper URLs
- **HTML Sanitization**: Built-in XSS protection

## Installation

```bash
npm install gc-parser
```

## Usage

### Basic Example

```typescript
import { Parser, defaultOptions } from 'gc-parser';

// Create parser with default options
const opts = defaultOptions();
opts.linkBaseURL = 'https://example.com';

const parser = new Parser(opts);

// Process content
const content = `# Hello World

This is **markdown** content with a nostr:npub1... address.`;

const result = await parser.process(content);
console.log(result.content);
console.log('Has LaTeX:', result.hasLaTeX);
console.log('Has Musical Notation:', result.hasMusicalNotation);
```

### Advanced Configuration

```typescript
import { Parser } from 'gc-parser';

const parser = new Parser({
  linkBaseURL: 'https://example.com',
  enableAsciiDoc: true,
  enableMarkdown: true,
  enableCodeHighlighting: true,
  enableLaTeX: true,
  enableMusicalNotation: true,
  enableNostrAddresses: true,
});

const result = await parser.process(content);
```

### Processing AsciiDoc

```typescript
const content = `= Document Title

== Section

This is AsciiDoc content with a [[wikilink]] and nostr:naddr1...`;

const result = await parser.process(content);
// result.content contains the HTML
// result.tableOfContents contains the extracted TOC
```

### Processing Markdown

```typescript
const content = `# Markdown Document

This is **bold** and *italic* text.

\`\`\`go
func main() {
    fmt.Println("Hello")
}
\`\`\`
`;

const result = await parser.process(content);
```

### LaTeX Math

The parser automatically detects and processes LaTeX math expressions:

- Inline math: `$E = mc^2$` or `\(E = mc^2\)`
- Block math: `$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$` or `\[...\]`

The output is compatible with MathJax or KaTeX. Include one of these libraries in your HTML:

```html
<!-- For MathJax -->
<script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>

<!-- Or for KaTeX -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
```

### Musical Notation

The parser supports multiple musical notation formats:

- **ABC Notation**: Automatically detected and wrapped for ABC.js
- **LilyPond**: Detected and wrapped for LilyPond rendering
- **Chord Notation**: Inline chords like `[C]`, `[Am]`, `[F#m7]`
- **MusicXML**: XML-based notation

Example:
```
X:1
K:C
C D E F | G A B c
```

### Nostr Addresses

The parser automatically processes `nostr:` prefixed addresses:

- `nostr:naddr1...` - Parameterized replaceable events
- `nostr:nevent1...` - Event references
- `nostr:note1...` - Note IDs
- `nostr:npub1...` - Public keys
- `nostr:nprofile1...` - Profile references

These are automatically converted to links if `linkBaseURL` is set.

## Integration with gitcitadel-online

This parser is designed to replace the content processing logic in `gitcitadel-online`. 

### Migration Example

**Before (in gitcitadel-online):**
```go
// Old way - calling Node.js via exec
result, err := g.asciidocProc.Process(wiki.Content)
html := result.Content
```

**After (using gc-parser):**
```go
// New way - import the JavaScript/TypeScript module
// You can call it via Node.js exec or use a Go bridge
const { Parser } = require('gc-parser');
const parser = new Parser({ linkBaseURL: 'https://example.com' });
const result = await parser.process(content);
```

Or use it directly in a Node.js script that gitcitadel-online can call:

```javascript
// process-content.js
const { Parser } = require('gc-parser');

const parser = new Parser({
  linkBaseURL: process.env.LINK_BASE_URL || '',
});

const content = process.argv[2] || '';
parser.process(content).then(result => {
  console.log(JSON.stringify(result));
}).catch(err => {
  console.error(err);
  process.exit(1);
});
```

## Requirements

- Node.js 18+ 
- TypeScript 5.3+ (for development)

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
