"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("./src/parser");
const report_generator_1 = require("./src/utils/report-generator");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Standalone script to generate HTML test report
 * Run with: npm run test:report
 */
async function main() {
    console.log('📝 Generating test report...\n');
    // Initialize parser
    const parser = new parser_1.Parser({
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
    const htmlReport = (0, report_generator_1.generateHTMLReport)({
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
//# sourceMappingURL=generate-test-report.js.map