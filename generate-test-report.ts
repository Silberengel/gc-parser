// Import from source files - this script should be run with ts-node or similar
// from the project root, not from dist/
import { Parser } from './src/parser';
import { generateHTMLReport } from './src/utils/report-generator';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Standalone script to generate HTML test report
 * Run with: npm run test:report
 */

async function main() {
  console.log('📝 Generating test report...\n');

  // Initialize parser
  const parser = new Parser({
    linkBaseURL: 'https://example.com',
    wikilinkUrl: '/events?d={dtag}',
    hashtagUrl: '/notes?t={topic}',
  });

  // Read test documents from project root
  const baseDir = __dirname.includes('dist') ? path.join(__dirname, '..') : __dirname;
  const markdownPath = path.join(baseDir, 'markdown_testdoc.md');
  const asciidocPath = path.join(baseDir, 'asciidoc_testdoc.adoc');

  if (!fs.existsSync(markdownPath)) {
    console.error(`❌ Error: ${markdownPath} not found`);
    process.exit(1);
  }

  if (!fs.existsSync(asciidocPath)) {
    console.error(`❌ Error: ${asciidocPath} not found`);
    process.exit(1);
  }

  const markdownContent = fs.readFileSync(markdownPath, 'utf-8');
  const asciidocContent = fs.readFileSync(asciidocPath, 'utf-8');

  console.log('📄 Parsing markdown document...');
  const markdownResult = await parser.process(markdownContent);

  console.log('📄 Parsing asciidoc document...');
  const asciidocResult = await parser.process(asciidocContent);

  console.log('🎨 Generating HTML report...');
  const htmlReport = generateHTMLReport({
    markdown: {
      original: markdownContent,
      result: markdownResult,
    },
    asciidoc: {
      original: asciidocContent,
      result: asciidocResult,
    },
  });

  // Write HTML report to file (adjust path based on where script is run from)
  const reportPath = path.join(baseDir, 'test-report.html');
  fs.writeFileSync(reportPath, htmlReport, 'utf-8');

  console.log(`\n✅ Test report generated: ${reportPath}`);
  console.log(`   Open this file in your browser to view the results.\n`);
}

// Run the script
main().catch((error) => {
  console.error('❌ Error generating test report:', error);
  process.exit(1);
});
