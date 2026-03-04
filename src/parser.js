"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
exports.defaultOptions = defaultOptions;
exports.process = process;
const detector_1 = require("./detector");
const to_asciidoc_1 = require("./converters/to-asciidoc");
const asciidoc_1 = require("./processors/asciidoc");
const metadata_1 = require("./extractors/metadata");
const frontmatter_1 = require("./extractors/frontmatter");
/**
 * Default parser options
 */
function defaultOptions() {
    return {
        linkBaseURL: '',
        enableAsciiDoc: true,
        enableMarkdown: true,
        enableCodeHighlighting: true,
        enableLaTeX: true,
        enableMusicalNotation: true,
        enableNostrAddresses: true,
    };
}
/**
 * Main parser for Nostr event content
 * Handles multiple content formats: AsciiDoc, Markdown, code syntax,
 * LaTeX, musical notation, and nostr: prefixed addresses
 *
 * Everything is converted to AsciiDoc first, then processed through AsciiDoctor
 */
class Parser {
    constructor(options = {}) {
        const defaults = defaultOptions();
        this.options = {
            linkBaseURL: options.linkBaseURL ?? defaults.linkBaseURL ?? '',
            enableAsciiDoc: options.enableAsciiDoc ?? defaults.enableAsciiDoc ?? true,
            enableMarkdown: options.enableMarkdown ?? defaults.enableMarkdown ?? true,
            enableCodeHighlighting: options.enableCodeHighlighting ?? defaults.enableCodeHighlighting ?? true,
            enableLaTeX: options.enableLaTeX ?? defaults.enableLaTeX ?? true,
            enableMusicalNotation: options.enableMusicalNotation ?? defaults.enableMusicalNotation ?? true,
            enableNostrAddresses: options.enableNostrAddresses ?? defaults.enableNostrAddresses ?? true,
            wikilinkUrl: options.wikilinkUrl ?? defaults.wikilinkUrl,
            hashtagUrl: options.hashtagUrl ?? defaults.hashtagUrl,
        };
    }
    /**
     * Process Nostr event content and return HTML
     * Automatically detects the content format and processes accordingly
     * Everything is converted to AsciiDoc first, then processed through AsciiDoctor
     */
    async process(content) {
        // Extract frontmatter first (before any other processing)
        const { frontmatter, content: contentWithoutFrontmatter } = (0, frontmatter_1.extractFrontmatter)(content);
        // Extract metadata from content (after removing frontmatter)
        const metadata = (0, metadata_1.extractMetadata)(contentWithoutFrontmatter, this.options.linkBaseURL);
        // Detect content format (on content without frontmatter)
        const format = (0, detector_1.detectFormat)(contentWithoutFrontmatter);
        // Convert everything to AsciiDoc format first
        const asciidocContent = (0, to_asciidoc_1.convertToAsciidoc)(contentWithoutFrontmatter, format, this.options.linkBaseURL, {
            enableNostrAddresses: this.options.enableNostrAddresses,
        });
        // Process through AsciiDoctor
        const result = await (0, asciidoc_1.processAsciidoc)(asciidocContent, {
            enableCodeHighlighting: this.options.enableCodeHighlighting,
            enableLaTeX: this.options.enableLaTeX,
            enableMusicalNotation: this.options.enableMusicalNotation,
            originalContent: contentWithoutFrontmatter, // Pass original for LaTeX detection
            linkBaseURL: this.options.linkBaseURL, // Pass linkBaseURL for link processing
            wikilinkUrl: this.options.wikilinkUrl, // Pass wikilink URL format
            hashtagUrl: this.options.hashtagUrl, // Pass hashtag URL format
        });
        // Combine with extracted metadata and frontmatter
        return {
            ...result,
            frontmatter,
            nostrLinks: metadata.nostrLinks,
            wikilinks: metadata.wikilinks,
            hashtags: metadata.hashtags,
            links: metadata.links,
            media: metadata.media,
        };
    }
}
exports.Parser = Parser;
/**
 * Convenience function to process content with default options
 */
async function process(content, options) {
    const parser = new Parser(options);
    return parser.process(content);
}
