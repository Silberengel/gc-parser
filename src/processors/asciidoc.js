"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAsciidoc = processAsciidoc;
const core_1 = __importDefault(require("@asciidoctor/core"));
const html_utils_1 = require("./html-utils");
const html_postprocess_1 = require("./html-postprocess");
const asciidoctorInstance = (0, core_1.default)();
/**
 * Processes AsciiDoc content to HTML using AsciiDoctor
 * Uses AsciiDoctor's built-in highlight.js and LaTeX support
 */
async function processAsciidoc(content, options = {}) {
    const { enableCodeHighlighting = true, enableLaTeX = true, enableMusicalNotation = true, } = options;
    // Check if content starts with level 3+ headers
    // Asciidoctor article doctype requires level 1 (=) or level 2 (==) before level 3 (===)
    // If content starts with level 3+, use book doctype
    const firstHeaderMatch = content.match(/^(={1,6})\s+/m);
    let doctype = 'article';
    if (firstHeaderMatch) {
        const firstHeaderLevel = firstHeaderMatch[1].length;
        if (firstHeaderLevel >= 3) {
            doctype = 'book';
        }
    }
    try {
        const result = asciidoctorInstance.convert(content, {
            safe: 'safe',
            backend: 'html5',
            doctype: doctype,
            attributes: {
                'showtitle': true,
                'sectanchors': true,
                'sectlinks': true,
                'toc': 'left',
                'toclevels': 6,
                'toc-title': 'Table of Contents',
                'source-highlighter': enableCodeHighlighting ? 'highlight.js' : 'none',
                'stem': enableLaTeX ? 'latexmath' : 'none',
                'plantuml': 'plantuml', // Enable PlantUML diagram support
                'data-uri': true,
                'imagesdir': '',
                'linkcss': false,
                'stylesheet': '',
                'stylesdir': '',
                'prewrap': true,
                'sectnums': false,
                'sectnumlevels': 6,
                'experimental': true,
                'compat-mode': false,
                'attribute-missing': 'warn',
                'attribute-undefined': 'warn',
                'skip-front-matter': true,
                'source-indent': 0,
                'indent': 0,
                'tabsize': 2,
                'tabwidth': 2,
                'hardbreaks': false,
                'paragraph-rewrite': 'normal',
                'sectids': true,
                'idprefix': '',
                'idseparator': '-',
                'sectidprefix': '',
                'sectidseparator': '-'
            }
        });
        const htmlString = typeof result === 'string' ? result : result.toString();
        // Extract table of contents from HTML
        const { toc, contentWithoutTOC } = (0, html_utils_1.extractTOC)(htmlString);
        // Sanitize HTML to prevent XSS
        const sanitized = (0, html_utils_1.sanitizeHTML)(contentWithoutTOC);
        // Post-process HTML: convert macros to HTML, add styling, etc.
        const processed = (0, html_postprocess_1.postProcessHtml)(sanitized, {
            enableMusicalNotation,
            linkBaseURL: options.linkBaseURL,
            wikilinkUrl: options.wikilinkUrl,
            hashtagUrl: options.hashtagUrl,
        });
        // Process links: add target="_blank" to external links
        const processedWithLinks = options.linkBaseURL
            ? (0, html_utils_1.processLinks)(processed, options.linkBaseURL)
            : processed;
        // Also process TOC
        const tocSanitized = (0, html_utils_1.sanitizeHTML)(toc);
        const tocProcessed = (0, html_postprocess_1.postProcessHtml)(tocSanitized, {
            enableMusicalNotation: false, // Don't process music in TOC
            linkBaseURL: options.linkBaseURL,
            wikilinkUrl: options.wikilinkUrl,
            hashtagUrl: options.hashtagUrl,
        });
        // Process links in TOC as well
        const tocProcessedWithLinks = options.linkBaseURL
            ? (0, html_utils_1.processLinks)(tocProcessed, options.linkBaseURL)
            : tocProcessed;
        // Check for LaTeX in original content (more reliable than checking HTML)
        const contentToCheck = options.originalContent || content;
        const hasLaTeX = enableLaTeX && hasMathContent(contentToCheck);
        // Check for musical notation in processed HTML
        const hasMusicalNotation = enableMusicalNotation && (/class="abc-notation"|class="lilypond-notation"|class="chord"|class="musicxml-notation"/.test(processed));
        return {
            content: processedWithLinks,
            tableOfContents: tocProcessedWithLinks,
            hasLaTeX,
            hasMusicalNotation,
            nostrLinks: [], // Will be populated by metadata extraction
            wikilinks: [],
            hashtags: [],
            links: [],
            media: [],
        };
    }
    catch (error) {
        // Fallback to plain text with error logging
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Use process.stderr.write for Node.js compatibility instead of console.error
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodeProcess = globalThis.process;
        if (nodeProcess?.stderr) {
            nodeProcess.stderr.write(`Error processing AsciiDoc: ${errorMessage}\n`);
        }
        // Escape HTML in content for safe display
        const escapedContent = (0, html_utils_1.sanitizeHTML)(content);
        return {
            content: `<p>${escapedContent}</p>`,
            tableOfContents: '',
            hasLaTeX: false,
            hasMusicalNotation: false,
            nostrLinks: [],
            wikilinks: [],
            hashtags: [],
            links: [],
            media: [],
        };
    }
}
/**
 * Check if content has LaTeX math
 * Based on jumble's detection pattern
 */
function hasMathContent(content) {
    // Check for inline math: $...$ or \(...\)
    const inlineMath = /\$[^$]+\$|\\\([^)]+\\\)/.test(content);
    // Check for block math: $$...$$ or \[...\]
    const blockMath = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/.test(content);
    return inlineMath || blockMath;
}
