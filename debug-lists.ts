import { convertToAsciidoc } from './src/converters/to-asciidoc';
import { detectFormat } from './src/detector';
import * as fs from 'fs';
import * as path from 'path';

// Read just the list section from markdown test doc
const markdownContent = fs.readFileSync(
  path.join(__dirname, 'markdown_testdoc.md'),
  'utf-8'
);

// Extract just the list sections
const listSection = markdownContent.split('## Bullet list')[1]?.split('##')[0] || markdownContent;

console.log('=== ORIGINAL MARKDOWN ===');
console.log(listSection);
console.log('\n=== DETECTED FORMAT ===');
const format = detectFormat(listSection);
console.log(format);

console.log('\n=== CONVERTED ASCIIDOC ===');
const asciidoc = convertToAsciidoc(listSection, format, '', {});
console.log(asciidoc);

// Write to file for inspection
fs.writeFileSync(path.join(__dirname, 'debug-asciidoc-output.adoc'), asciidoc);
console.log('\n=== Written to debug-asciidoc-output.adoc ===');
