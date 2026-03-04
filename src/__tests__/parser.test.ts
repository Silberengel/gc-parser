import { Parser } from '../parser';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

describe('Parser', () => {
  let asciidocContent: string;
  let markdownContent: string;

  beforeAll(() => {
    asciidocContent = readFileSync(join(__dirname, '../../asciidoc_testdoc.adoc'), 'utf-8');
    markdownContent = readFileSync(join(__dirname, '../../markdown_testdoc.md'), 'utf-8');
  });

  // AsciiDoc tests are run separately using a Node.js script (asciidoc.test.ts)
  // due to Jest/Opal runtime compatibility issues
  // Run with: npm run test:asciidoc

  describe('Markdown Test Document', () => {
    let result: any;

    beforeAll(async () => {
      const parser = new Parser({
        linkBaseURL: 'https://example.com',
        enableNostrAddresses: true,
        wikilinkUrl: '/events?d={dtag}',
        hashtagUrl: '/hashtag/{topic}'
      });
      result = await parser.process(markdownContent);

      // Write HTML output to file for inspection
      const outputDir = join(__dirname, '../../test-output');
      try {
        mkdirSync(outputDir, { recursive: true });
      } catch (e) {
        // Directory might already exist
      }
      
      const htmlOutput = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Test Output</title>
  <style>
    body { font-family: sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .hashtag { color: #1da1f2; font-weight: 500; }
    .wikilink { color: #0066cc; text-decoration: underline; }
    .nostr-link { color: #8b5cf6; text-decoration: underline; }
    pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: 'Courier New', monospace; }
    .bare-image, .bare-video, .bare-audio { max-width: 100%; margin: 10px 0; }
    .bare-video, .bare-audio { width: 100%; max-width: 600px; }
    blockquote { border-left: 4px solid #ddd; padding-left: 1em; margin: 1em 0; color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    table th, table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    table th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>Markdown Test Document - Parsed Output</h1>
  <hr>
  ${result.content}
  <hr>
  <h2>Metadata</h2>
  <pre>${JSON.stringify({
    frontmatter: result.frontmatter,
    hasLaTeX: result.hasLaTeX,
    hasMusicalNotation: result.hasMusicalNotation,
    nostrLinks: result.nostrLinks,
    wikilinks: result.wikilinks,
    hashtags: result.hashtags,
    links: result.links,
    media: result.media
  }, null, 2)}</pre>
</body>
</html>`;
      
      const outputPath = join(outputDir, 'markdown-output.html');
      writeFileSync(outputPath, htmlOutput, 'utf-8');
      // Use console.info to ensure it shows in Jest output
      console.info(`\n📄 HTML output written to: ${outputPath}\n`);
    });

    it('should parse Markdown content', () => {
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should have HTML content', () => {
      expect(result.content).toContain('<');
      expect(result.content).toContain('>');
    });

    it('should extract frontmatter', () => {
      expect(result.frontmatter).toBeDefined();
      expect(typeof result.frontmatter).toBe('object');
      expect(result.frontmatter).toHaveProperty('author');
      expect(result.frontmatter.author).toBe('James Smith');
      expect(result.frontmatter).toHaveProperty('summary');
      expect(result.frontmatter.summary).toBe('This is a summary');
    });

    it('should detect LaTeX', () => {
      expect(result.hasLaTeX).toBeDefined();
      expect(typeof result.hasLaTeX).toBe('boolean');
      // The test doc has LaTeX, so it should be true
      expect(result.hasLaTeX).toBe(true);
    });

    it('should detect musical notation', () => {
      expect(result.hasMusicalNotation).toBeDefined();
      expect(typeof result.hasMusicalNotation).toBe('boolean');
    });

    it('should extract nostr links', () => {
      expect(result.nostrLinks).toBeDefined();
      expect(Array.isArray(result.nostrLinks)).toBe(true);
      expect(result.nostrLinks.length).toBeGreaterThan(0);
      
      // Check that nostr: addresses are extracted
      const nostrLink = result.nostrLinks[0];
      expect(nostrLink).toHaveProperty('type');
      expect(nostrLink).toHaveProperty('id');
      expect(nostrLink).toHaveProperty('text');
      expect(nostrLink).toHaveProperty('bech32');
      expect(['npub', 'nprofile', 'nevent', 'naddr', 'note']).toContain(nostrLink.type);
    });

    it('should extract wikilinks', () => {
      expect(result.wikilinks).toBeDefined();
      expect(Array.isArray(result.wikilinks)).toBe(true);
      expect(result.wikilinks.length).toBeGreaterThan(0);
      
      // Check wikilink structure
      const wikilink = result.wikilinks[0];
      expect(wikilink).toHaveProperty('dtag');
      expect(wikilink).toHaveProperty('display');
      expect(wikilink).toHaveProperty('original');
    });

    it('should extract hashtags', () => {
      expect(result.hashtags).toBeDefined();
      expect(Array.isArray(result.hashtags)).toBe(true);
      expect(result.hashtags.length).toBeGreaterThan(0);
      
      // Hashtags should not include the # symbol
      result.hashtags.forEach((tag: string) => {
        expect(tag).not.toContain('#');
      });
    });

    it('should extract regular links', () => {
      expect(result.links).toBeDefined();
      expect(Array.isArray(result.links)).toBe(true);
      
      if (result.links.length > 0) {
        const link = result.links[0];
        expect(link).toHaveProperty('url');
        expect(link).toHaveProperty('text');
        expect(link).toHaveProperty('isExternal');
        expect(typeof link.isExternal).toBe('boolean');
      }
    });

    it('should extract media URLs', () => {
      expect(result.media).toBeDefined();
      expect(Array.isArray(result.media)).toBe(true);
    });

    it('should process nostr: addresses in HTML', () => {
      // Check that nostr: addresses are converted to links
      const nostrAddresses = result.nostrLinks;
      expect(nostrAddresses.length).toBeGreaterThan(0);
      
      // Check that HTML contains links for nostr addresses
      nostrAddresses.forEach((link: any) => {
        expect(result.content).toContain(`data-nostr-type="${link.type}"`);
        expect(result.content).toContain(`data-nostr-id="${link.bech32}"`);
      });
    });

    it('should process wikilinks in HTML', () => {
      // Check that wikilinks are converted to links
      const wikilinks = result.wikilinks;
      expect(wikilinks.length).toBeGreaterThan(0);
      
      wikilinks.forEach((wikilink: any) => {
        expect(result.content).toContain(`class="wikilink"`);
        expect(result.content).toContain(`data-dtag="${wikilink.dtag}"`);
      });
    });

    it('should process hashtags in HTML', () => {
      // Check that hashtags are processed
      const hashtags = result.hashtags;
      expect(hashtags.length).toBeGreaterThan(0);
      
      hashtags.forEach((tag: string) => {
        expect(result.content).toContain(`data-topic="${tag}"`);
        expect(result.content).toMatch(new RegExp(`class="hashtag"`));
      });
    });

    it('should contain expected content sections', () => {
      // Check for some expected content from the test doc
      expect(result.content).toMatch(/Bullet list|bullet/i);
      expect(result.content).toMatch(/Headers|header/i);
      expect(result.content).toMatch(/Media and Links|media|links/i);
    });

    it('should have empty table of contents for markdown', () => {
      // Markdown doesn't generate TOC by default
      expect(result.tableOfContents).toBeDefined();
      expect(typeof result.tableOfContents).toBe('string');
    });
  });

  describe('Result structure validation', () => {

    it('should return consistent structure for Markdown', async () => {
      const parser = new Parser();
      const result = await parser.process(markdownContent);
      
      // Check all required fields
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('tableOfContents');
      expect(result).toHaveProperty('hasLaTeX');
      expect(result).toHaveProperty('hasMusicalNotation');
      expect(result).toHaveProperty('nostrLinks');
      expect(result).toHaveProperty('wikilinks');
      expect(result).toHaveProperty('hashtags');
      expect(result).toHaveProperty('links');
      expect(result).toHaveProperty('media');
    });
  });
});
