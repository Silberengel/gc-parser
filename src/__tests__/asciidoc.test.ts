import { Parser } from '../parser';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Simple test runner for AsciiDoc tests (separate from Jest due to Opal compatibility issues)
 */
async function runAsciiDocTests() {
  console.log('Running AsciiDoc tests...\n');
  
  const asciidocContent = readFileSync(join(__dirname, '../../asciidoc_testdoc.adoc'), 'utf-8');
  const parser = new Parser({
    linkBaseURL: 'https://example.com',
    enableNostrAddresses: true,
    wikilinkUrl: '/events?d={dtag}',
    hashtagUrl: '/hashtag/{topic}'
  });

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  const testPromises: Promise<void>[] = [];

  function test(name: string, fn: () => void | Promise<void>) {
    const testPromise = (async () => {
      try {
        const result = fn();
        if (result instanceof Promise) {
          await result;
        }
        passed++;
        console.log(`✓ ${name}`);
      } catch (error: any) {
        failed++;
        failures.push(`${name}: ${error.message}`);
        console.error(`✗ ${name}: ${error.message}`);
      }
    })();
    testPromises.push(testPromise);
  }

  function expect(actual: any) {
    return {
      toBeDefined: () => {
        if (actual === undefined || actual === null) {
          throw new Error(`Expected value to be defined, but got ${actual}`);
        }
      },
      toBe: (expected: any) => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, but got ${actual}`);
        }
      },
      toContain: (substring: string) => {
        if (typeof actual === 'string' && !actual.includes(substring)) {
          throw new Error(`Expected string to contain "${substring}"`);
        }
      },
      toMatch: (regex: RegExp) => {
        if (typeof actual === 'string' && !regex.test(actual)) {
          throw new Error(`Expected string to match ${regex}`);
        }
      },
      toHaveProperty: (prop: string) => {
        if (!(prop in actual)) {
          throw new Error(`Expected object to have property "${prop}"`);
        }
      },
      toBeGreaterThan: (value: number) => {
        if (typeof actual !== 'number' || actual <= value) {
          throw new Error(`Expected ${actual} to be greater than ${value}`);
        }
      },
      length: {
        toBeGreaterThan: (value: number) => {
          if (!Array.isArray(actual) || actual.length <= value) {
            throw new Error(`Expected array length to be greater than ${value}, but got ${actual.length}`);
          }
        }
      }
    };
  }

  // Run tests
  const result = await parser.process(asciidocContent);

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
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://www.gstatic.com https://*.googlevideo.com; frame-src https://www.youtube.com https://youtube.com https://open.spotify.com https://*.googlevideo.com; style-src 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' https:; connect-src https:; child-src https://www.youtube.com https://youtube.com;">
  <title>AsciiDoc Test Output</title>
  <style>
    body { font-family: sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .hashtag { color: #1da1f2; font-weight: 500; }
    .wikilink { color: #0066cc; text-decoration: underline; }
    .nostr-link { color: #8b5cf6; text-decoration: underline; }
    pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: 'Courier New', monospace; }
    .line-through { text-decoration: line-through; }
    .highlight { background-color: #ffeb3b; padding: 2px 4px; border-radius: 3px; }
    .bare-image { max-width: 100%; width: auto; height: auto; margin: 10px 0; display: block; }
    .bare-video, .bare-audio { width: 100%; max-width: 800px; margin: 10px 0; display: block; }
    .youtube-embed, .spotify-embed { max-width: 100%; margin: 10px 0; border-radius: 8px; display: block; }
    .youtube-embed { width: 100%; max-width: 640px; height: auto; aspect-ratio: 16/9; border: 0; display: block; }
    .spotify-embed { width: 100%; max-width: 800px; }
    /* Table styles */
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    table thead { background-color: #f2f2f2; }
    table th { font-weight: bold; padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2; }
    table td { padding: 8px; border: 1px solid #ddd; }
    /* Alignment classes - AsciiDoc uses halign-* and valign-* classes */
    .halign-left { text-align: left !important; }
    .halign-center { text-align: center !important; }
    .halign-right { text-align: right !important; }
    .valign-top { vertical-align: top !important; }
    .valign-middle { vertical-align: middle !important; }
    .valign-bottom { vertical-align: bottom !important; }
    /* Also handle tableblock classes */
    .tableblock.halign-left { text-align: left !important; }
    .tableblock.halign-center { text-align: center !important; }
    .tableblock.halign-right { text-align: right !important; }
    .tableblock.valign-top { vertical-align: top !important; }
    .tableblock.valign-middle { vertical-align: middle !important; }
    .tableblock.valign-bottom { vertical-align: bottom !important; }
    /* Task list styles */
    .checklist { list-style: none; padding-left: 0; }
    .checklist li { padding-left: 1.5em; position: relative; margin: 0.5em 0; }
    .checklist li i.fa-check-square-o::before { content: "☑ "; font-style: normal; font-family: sans-serif; }
    .checklist li i.fa-square-o::before { content: "☐ "; font-style: normal; font-family: sans-serif; }
    .checklist li i { position: absolute; left: 0; font-style: normal; }
    /* Fallback if Font Awesome doesn't load */
    .checklist li i.fa-check-square-o { display: inline-block; width: 1em; }
    .checklist li i.fa-check-square-o:before { content: "☑"; }
    .checklist li i.fa-square-o { display: inline-block; width: 1em; }
    .checklist li i.fa-square-o:before { content: "☐"; }
    /* AsciiDoc specific styles */
    .sect1, .sect2, .sect3, .sect4, .sect5 { margin-top: 1.5em; margin-bottom: 1em; }
    .paragraph { margin: 1em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    table th, table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    table th { background-color: #f2f2f2; }
    blockquote { border-left: 4px solid #ddd; padding-left: 1em; margin: 1em 0; color: #666; }
  </style>
</head>
<body>
  <h1>AsciiDoc Test Document - Parsed Output</h1>
  <hr>
  ${result.content}
  <hr>
  <h2>Metadata</h2>
  <pre>${JSON.stringify({
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
  
  const outputPath = join(outputDir, 'asciidoc-output.html');
  writeFileSync(outputPath, htmlOutput, 'utf-8');
  console.log(`\n📄 HTML output written to: ${outputPath}\n`);

  test('should parse AsciiDoc content', () => {
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(typeof result.content).toBe('string');
    expect(result.content.length).toBeGreaterThan(0);
  });

  test('should have HTML content', () => {
    expect(result.content).toContain('<');
    expect(result.content).toContain('>');
  });

  test('should extract table of contents', () => {
    expect(result.tableOfContents).toBeDefined();
    expect(typeof result.tableOfContents).toBe('string');
  });

  test('should detect LaTeX', () => {
    expect(result.hasLaTeX).toBeDefined();
    expect(typeof result.hasLaTeX).toBe('boolean');
    expect(result.hasLaTeX).toBe(true);
  });

  test('should detect musical notation', () => {
    expect(result.hasMusicalNotation).toBeDefined();
    expect(typeof result.hasMusicalNotation).toBe('boolean');
    expect(result.hasMusicalNotation).toBe(true);
  });

  test('should extract nostr links', () => {
    expect(result.nostrLinks).toBeDefined();
    expect(Array.isArray(result.nostrLinks)).toBe(true);
    expect(result.nostrLinks.length).toBeGreaterThan(0);
    
    const nostrLink = result.nostrLinks[0];
    expect(nostrLink).toHaveProperty('type');
    expect(nostrLink).toHaveProperty('id');
    expect(nostrLink).toHaveProperty('text');
    expect(nostrLink).toHaveProperty('bech32');
    const validTypes = ['npub', 'nprofile', 'nevent', 'naddr', 'note'];
    if (!validTypes.includes(nostrLink.type)) {
      throw new Error(`Invalid nostr type: ${nostrLink.type}`);
    }
  });

  test('should extract wikilinks', () => {
    expect(result.wikilinks).toBeDefined();
    expect(Array.isArray(result.wikilinks)).toBe(true);
    expect(result.wikilinks.length).toBeGreaterThan(0);
    
    const wikilink = result.wikilinks[0];
    expect(wikilink).toHaveProperty('dtag');
    expect(wikilink).toHaveProperty('display');
    expect(wikilink).toHaveProperty('original');
  });

  test('should extract hashtags', () => {
    expect(result.hashtags).toBeDefined();
    expect(Array.isArray(result.hashtags)).toBe(true);
    expect(result.hashtags.length).toBeGreaterThan(0);
    
    result.hashtags.forEach((tag: string) => {
      if (tag.includes('#')) {
        throw new Error(`Hashtag should not include #: ${tag}`);
      }
    });
  });

  test('should extract regular links', () => {
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

  test('should extract media URLs', () => {
    expect(result.media).toBeDefined();
    expect(Array.isArray(result.media)).toBe(true);
  });

  test('should process nostr: addresses in HTML', () => {
    const nostrAddresses = result.nostrLinks;
    expect(nostrAddresses.length).toBeGreaterThan(0);
    
    nostrAddresses.forEach((link: any) => {
      if (!result.content.includes(`data-nostr-type="${link.type}"`)) {
        throw new Error(`Missing nostr type attribute for ${link.type}`);
      }
      if (!result.content.includes(`data-nostr-id="${link.bech32}"`)) {
        throw new Error(`Missing nostr id attribute for ${link.bech32}`);
      }
    });
  });

  test('should process wikilinks in HTML', () => {
    const wikilinks = result.wikilinks;
    expect(wikilinks.length).toBeGreaterThan(0);
    
    wikilinks.forEach((wikilink: any) => {
      if (!result.content.includes(`class="wikilink"`)) {
        throw new Error('Missing wikilink class');
      }
      if (!result.content.includes(`data-dtag="${wikilink.dtag}"`)) {
        throw new Error(`Missing dtag attribute for ${wikilink.dtag}`);
      }
    });
  });

  test('should process hashtags in HTML', () => {
    const hashtags = result.hashtags;
    expect(hashtags.length).toBeGreaterThan(0);
    
    hashtags.forEach((tag: string) => {
      if (!result.content.includes(`data-topic="${tag}"`)) {
        throw new Error(`Missing topic attribute for ${tag}`);
      }
      if (!result.content.includes('class="hashtag"')) {
        throw new Error('Missing hashtag class');
      }
    });
  });

  test('should contain expected content sections', () => {
    if (!/Bullet list|bullet/i.test(result.content)) {
      throw new Error('Missing bullet list section');
    }
    if (!/Headers|header/i.test(result.content)) {
      throw new Error('Missing headers section');
    }
    if (!/Media and Links|media|links/i.test(result.content)) {
      throw new Error('Missing media and links section');
    }
  });

  test('should return consistent structure', () => {
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

  // Wait for all tests to complete
  await Promise.all(testPromises);

  // Print summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Tests passed: ${passed}`);
  console.log(`Tests failed: ${failed}`);
  
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
    process.exit(0);
  }
}

// Run tests
runAsciiDocTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
