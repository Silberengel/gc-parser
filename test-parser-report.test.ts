import { Parser } from './src/parser';
import { generateHTMLReport } from './src/utils/report-generator';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test that parses both markdown and asciidoc test documents
 * and generates an HTML report showing the parsing results
 */
describe('Parser Test Report', () => {
  const parser = new Parser({
    linkBaseURL: 'https://example.com',
    wikilinkUrl: '/events?d={dtag}',
    hashtagUrl: '/notes?t={topic}',
  });

  test('Generate HTML test report for markdown and asciidoc documents', async () => {
    // Read test documents
    const markdownContent = fs.readFileSync(
      path.join(__dirname, 'markdown_testdoc.md'),
      'utf-8'
    );
    const asciidocContent = fs.readFileSync(
      path.join(__dirname, 'asciidoc_testdoc.adoc'),
      'utf-8'
    );

    // Parse both documents
    const markdownResult = await parser.process(markdownContent);
    const asciidocResult = await parser.process(asciidocContent);

    // Generate HTML report
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

    // Basic assertions to ensure parsing worked
    expect(markdownResult.content).toBeTruthy();
    expect(asciidocResult.content).toBeTruthy();
    expect(markdownResult.content.length).toBeGreaterThan(0);
    expect(asciidocResult.content.length).toBeGreaterThan(0);
  });
});
