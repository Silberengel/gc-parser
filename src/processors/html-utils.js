"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTOC = extractTOC;
exports.sanitizeHTML = sanitizeHTML;
exports.processLinks = processLinks;
/**
 * Extracts the table of contents from AsciiDoc HTML output
 * Returns the TOC HTML and the content HTML without the TOC
 */
function extractTOC(html) {
    // AsciiDoc with toc: 'left' generates a TOC in a div with id="toc" or class="toc"
    let tocContent = '';
    let contentWithoutTOC = html;
    // Find the start of the TOC div - try multiple patterns
    const tocStartPatterns = [
        /<div\s+id=["']toc["']\s+class=["']toc["'][^>]*>/i,
        /<div\s+id=["']toc["'][^>]*>/i,
        /<div\s+class=["']toc["'][^>]*>/i,
        /<nav\s+id=["']toc["'][^>]*>/i,
    ];
    let tocStartIdx = -1;
    let tocStartTag = '';
    for (const pattern of tocStartPatterns) {
        const match = html.match(pattern);
        if (match && match.index !== undefined) {
            tocStartIdx = match.index;
            tocStartTag = match[0];
            break;
        }
    }
    if (tocStartIdx === -1) {
        // No TOC found
        return { toc: '', contentWithoutTOC: html };
    }
    // Find the matching closing tag by counting div/nav tags
    const searchStart = tocStartIdx + tocStartTag.length;
    let depth = 1;
    let i = searchStart;
    while (i < html.length && depth > 0) {
        // Look for opening or closing div/nav tags
        if (i + 4 < html.length && html.substring(i, i + 4).toLowerCase() === '<div') {
            // Check if it's a closing tag
            if (i + 5 < html.length && html[i + 4] === '/') {
                depth--;
                const closeIdx = html.indexOf('>', i);
                if (closeIdx === -1)
                    break;
                i = closeIdx + 1;
            }
            else {
                // Opening tag - find the end (handle attributes and self-closing)
                const closeIdx = html.indexOf('>', i);
                if (closeIdx === -1)
                    break;
                // Check if it's self-closing (look for /> before the >)
                const tagContent = html.substring(i, closeIdx);
                if (!tagContent.endsWith('/')) {
                    depth++;
                }
                i = closeIdx + 1;
            }
        }
        else if (i + 5 < html.length && html.substring(i, i + 5).toLowerCase() === '</div') {
            depth--;
            const closeIdx = html.indexOf('>', i);
            if (closeIdx === -1)
                break;
            i = closeIdx + 1;
        }
        else if (i + 5 < html.length && html.substring(i, i + 5).toLowerCase() === '</nav') {
            depth--;
            const closeIdx = html.indexOf('>', i);
            if (closeIdx === -1)
                break;
            i = closeIdx + 1;
        }
        else if (i + 4 < html.length && html.substring(i, i + 4).toLowerCase() === '<nav') {
            // Handle opening nav tags
            const closeIdx = html.indexOf('>', i);
            if (closeIdx === -1)
                break;
            const tagContent = html.substring(i, closeIdx);
            if (!tagContent.endsWith('/')) {
                depth++;
            }
            i = closeIdx + 1;
        }
        else {
            i++;
        }
    }
    if (depth === 0) {
        // Found the matching closing tag
        const tocEndIdx = i;
        // Extract the TOC content (inner HTML)
        const tocFullHTML = html.substring(tocStartIdx, tocEndIdx);
        // Extract just the inner content (without the outer div tags)
        let innerStart = tocStartTag.length;
        let innerEnd = tocFullHTML.length;
        // Find the last </div> or </nav>
        if (tocFullHTML.endsWith('</div>')) {
            innerEnd -= 6;
        }
        else if (tocFullHTML.endsWith('</nav>')) {
            innerEnd -= 7;
        }
        tocContent = tocFullHTML.substring(innerStart, innerEnd).trim();
        // Remove the toctitle div if present (AsciiDoc adds "Table of Contents" title)
        tocContent = tocContent.replace(/<div\s+id=["']toctitle["'][^>]*>.*?<\/div>\s*/gis, '');
        tocContent = tocContent.trim();
        // Remove the TOC from the content
        contentWithoutTOC = html.substring(0, tocStartIdx) + html.substring(tocEndIdx);
    }
    // Extract just the body content if the HTML includes full document structure
    // AsciiDoctor might return full HTML with <html>, <head>, <body> tags
    // Check if this is a full HTML document
    const isFullDocument = /^\s*<!DOCTYPE|^\s*<html/i.test(contentWithoutTOC);
    if (isFullDocument) {
        // Extract body content using a more robust approach
        // Find the opening <body> tag
        const bodyStartMatch = contentWithoutTOC.match(/<body[^>]*>/i);
        if (bodyStartMatch && bodyStartMatch.index !== undefined) {
            const bodyStart = bodyStartMatch.index + bodyStartMatch[0].length;
            // Find the closing </body> tag by searching backwards from the end
            // This is more reliable than regex for nested content
            const bodyEndMatch = contentWithoutTOC.lastIndexOf('</body>');
            if (bodyEndMatch !== -1 && bodyEndMatch > bodyStart) {
                contentWithoutTOC = contentWithoutTOC.substring(bodyStart, bodyEndMatch).trim();
            }
        }
    }
    // Remove any remaining document structure tags that might have slipped through
    contentWithoutTOC = contentWithoutTOC
        .replace(/<html[^>]*>/gi, '')
        .replace(/<\/html>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
        .replace(/<body[^>]*>/gi, '')
        .replace(/<\/body>/gi, '');
    // Clean up any extra whitespace
    contentWithoutTOC = contentWithoutTOC.trim();
    return { toc: tocContent, contentWithoutTOC };
}
/**
 * Performs basic HTML sanitization to prevent XSS
 */
function sanitizeHTML(html) {
    // Remove script tags and their content
    html = html.replace(/<script[^>]*>.*?<\/script>/gis, '');
    // Remove event handlers (onclick, onerror, etc.)
    html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    // Remove javascript: protocol in links
    html = html.replace(/javascript:/gi, '');
    // Remove data: URLs that could be dangerous
    html = html.replace(/data:\s*text\/html/gi, '');
    return html;
}
/**
 * Processes HTML links to add target="_blank" to external links
 * This function is available for use but not currently called automatically.
 * It can be used in post-processing if needed.
 */
function processLinks(html, linkBaseURL) {
    // Extract domain from linkBaseURL for comparison
    let linkBaseDomain = '';
    if (linkBaseURL) {
        try {
            // Use URL constructor if available (Node.js 10+)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const URLConstructor = globalThis.URL;
            if (URLConstructor) {
                const url = new URLConstructor(linkBaseURL);
                linkBaseDomain = url.hostname;
            }
            else {
                throw new Error('URL not available');
            }
        }
        catch {
            // Fallback to simple string parsing if URL constructor fails
            const url = linkBaseURL.replace(/^https?:\/\//, '');
            const parts = url.split('/');
            if (parts.length > 0) {
                linkBaseDomain = parts[0];
            }
        }
    }
    // Regex to match <a> tags with href attributes
    const linkRegex = /<a\s+([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>/g;
    return html.replace(linkRegex, (match, before, href, after) => {
        // Check if it's an external link (starts with http:// or https://)
        const isExternal = href.startsWith('http://') || href.startsWith('https://');
        if (isExternal) {
            // Check if it's pointing to our own domain
            if (linkBaseDomain) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const URLConstructor = globalThis.URL;
                    if (URLConstructor) {
                        const hrefUrl = new URLConstructor(href);
                        if (hrefUrl.hostname === linkBaseDomain) {
                            // Same domain - open in same tab (remove any existing target attribute)
                            return match.replace(/\s*target\s*=\s*["'][^"']*["']/gi, '');
                        }
                    }
                    else {
                        throw new Error('URL not available');
                    }
                }
                catch {
                    // If URL parsing fails, use simple string check
                    if (href.includes(linkBaseDomain)) {
                        return match.replace(/\s*target\s*=\s*["'][^"']*["']/gi, '');
                    }
                }
            }
            // External link - add target="_blank" and rel="noopener noreferrer" if not already present
            if (!match.includes('target=')) {
                if (!match.includes('rel=')) {
                    return match.replace('>', ' target="_blank" rel="noopener noreferrer">');
                }
                else {
                    // Update existing rel attribute to include noopener if not present
                    const updatedMatch = match.replace(/rel\s*=\s*["']([^"']*)["']/gi, (relMatch, relValue) => {
                        if (!relValue.includes('noopener')) {
                            return `rel="${relValue} noopener noreferrer"`;
                        }
                        return relMatch;
                    });
                    return updatedMatch.replace('>', ' target="_blank">');
                }
            }
        }
        else {
            // Local/relative link - ensure it opens in same tab (remove target if present)
            return match.replace(/\s*target\s*=\s*["'][^"']*["']/gi, '');
        }
        return match;
    });
}
