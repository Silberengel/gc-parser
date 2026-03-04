import { Parser } from './src/parser';
import { generateHTMLReport, ReportData } from './src/utils/report-generator';
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

  // Read test documents
  const markdownPath = path.join(__dirname, 'markdown_testdoc.md');
  const asciidocPath = path.join(__dirname, 'asciidoc_testdoc.adoc');

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

  // Write HTML report to file
  const reportPath = path.join(__dirname, 'test-report.html');
  fs.writeFileSync(reportPath, htmlReport, 'utf-8');

  console.log(`\n✅ Test report generated: ${reportPath}`);
  console.log(`   Open this file in your browser to view the results.\n`);
}

// Run the script
main().catch((error) => {
  console.error('❌ Error generating test report:', error);
  process.exit(1);
});
