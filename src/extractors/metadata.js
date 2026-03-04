"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMetadata = extractMetadata;
/**
 * Extracts metadata from content before processing
 */
function extractMetadata(content, linkBaseURL) {
    return {
        nostrLinks: extractNostrLinks(content),
        wikilinks: extractWikilinks(content),
        hashtags: extractHashtags(content),
        links: extractLinks(content, linkBaseURL),
        media: extractMedia(content),
    };
}
/**
 * Extract Nostr links from content
 */
function extractNostrLinks(content) {
    const nostrLinks = [];
    const seen = new Set();
    // Extract nostr: prefixed links (valid bech32 format)
    const nostrMatches = content.match(/nostr:((?:npub|nprofile|nevent|naddr|note)1[a-z0-9]{6,})/gi) || [];
    nostrMatches.forEach(match => {
        const id = match.substring(6); // Remove 'nostr:'
        const type = getNostrType(id);
        if (type && !seen.has(id)) {
            seen.add(id);
            nostrLinks.push({
                type,
                id,
                text: match,
                bech32: id,
            });
        }
    });
    return nostrLinks;
}
/**
 * Extract wikilinks from content
 */
function extractWikilinks(content) {
    const wikilinks = [];
    const seen = new Set();
    // Match [[target]] or [[target|display]]
    const wikilinkPattern = /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g;
    let match;
    while ((match = wikilinkPattern.exec(content)) !== null) {
        const target = match[1].trim();
        const display = match[2] ? match[2].trim() : target;
        const dtag = normalizeDtag(target);
        const key = `${dtag}|${display}`;
        if (!seen.has(key)) {
            seen.add(key);
            wikilinks.push({
                dtag,
                display,
                original: match[0],
            });
        }
    }
    return wikilinks;
}
/**
 * Extract hashtags from content
 * Excludes hashtags in URLs, code blocks, and inline code
 */
function extractHashtags(content) {
    const hashtags = [];
    const seen = new Set();
    // Remove code blocks first to avoid matching inside them
    const codeBlockPattern = /```[\s\S]*?```/g;
    const inlineCodePattern = /`[^`]+`/g;
    const urlPattern = /https?:\/\/[^\s<>"']+/g;
    let processedContent = content
        .replace(codeBlockPattern, '') // Remove code blocks
        .replace(inlineCodePattern, '') // Remove inline code
        .replace(urlPattern, ''); // Remove URLs
    // Extract hashtags: #hashtag (word boundary to avoid matching in URLs)
    const hashtagPattern = /\B#([a-zA-Z0-9_]+)/g;
    let match;
    while ((match = hashtagPattern.exec(processedContent)) !== null) {
        const tag = match[1].toLowerCase();
        if (!seen.has(tag)) {
            hashtags.push(tag);
            seen.add(tag);
        }
    }
    return hashtags;
}
/**
 * Extract regular links from content
 */
function extractLinks(content, linkBaseURL) {
    const links = [];
    const seen = new Set();
    // Extract markdown links: [text](url) - optimized to avoid double matching
    const markdownLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let markdownMatch;
    while ((markdownMatch = markdownLinkPattern.exec(content)) !== null) {
        const [, text, url] = markdownMatch;
        if (!seen.has(url) && !isNostrUrl(url)) {
            seen.add(url);
            links.push({
                url,
                text,
                isExternal: isExternalUrl(url, linkBaseURL),
            });
        }
    }
    // Extract asciidoc links: link:url[text] - optimized to avoid double matching
    const asciidocLinkPattern = /link:([^\[]+)\[([^\]]+)\]/g;
    let asciidocMatch;
    while ((asciidocMatch = asciidocLinkPattern.exec(content)) !== null) {
        const [, url, text] = asciidocMatch;
        if (!seen.has(url) && !isNostrUrl(url)) {
            seen.add(url);
            links.push({
                url,
                text,
                isExternal: isExternalUrl(url, linkBaseURL),
            });
        }
    }
    // Extract raw URLs (basic pattern)
    const urlPattern = /https?:\/\/[^\s<>"']+/g;
    const rawUrls = content.match(urlPattern) || [];
    rawUrls.forEach(url => {
        if (!seen.has(url) && !isNostrUrl(url)) {
            seen.add(url);
            links.push({
                url,
                text: url,
                isExternal: isExternalUrl(url, linkBaseURL),
            });
        }
    });
    return links;
}
/**
 * Extract media URLs from content
 */
function extractMedia(content) {
    const media = [];
    const seen = new Set();
    // Extract markdown images: ![alt](url) - optimized to avoid double matching
    const markdownImagePattern = /!\[[^\]]*\]\(([^)]+)\)/g;
    let markdownImageMatch;
    while ((markdownImageMatch = markdownImagePattern.exec(content)) !== null) {
        const url = markdownImageMatch[1];
        if (url && !seen.has(url)) {
            if (isImageUrl(url) || isVideoUrl(url)) {
                media.push(url);
                seen.add(url);
            }
        }
    }
    // Extract asciidoc images: image::url[alt] - optimized to avoid double matching
    const asciidocImagePattern = /image::([^\[]+)\[/g;
    let asciidocImageMatch;
    while ((asciidocImageMatch = asciidocImagePattern.exec(content)) !== null) {
        const url = asciidocImageMatch[1];
        if (url && !seen.has(url)) {
            if (isImageUrl(url) || isVideoUrl(url)) {
                media.push(url);
                seen.add(url);
            }
        }
    }
    // Extract raw image/video URLs
    const urlPattern = /https?:\/\/[^\s<>"']+/g;
    const rawUrls = content.match(urlPattern) || [];
    rawUrls.forEach(url => {
        if (!seen.has(url) && (isImageUrl(url) || isVideoUrl(url))) {
            media.push(url);
            seen.add(url);
        }
    });
    return media;
}
/**
 * Get Nostr identifier type
 */
function getNostrType(id) {
    if (id.startsWith('npub'))
        return 'npub';
    if (id.startsWith('nprofile'))
        return 'nprofile';
    if (id.startsWith('nevent'))
        return 'nevent';
    if (id.startsWith('naddr'))
        return 'naddr';
    if (id.startsWith('note'))
        return 'note';
    return null;
}
/**
 * Normalize text to d-tag format
 */
function normalizeDtag(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
/**
 * Check if URL is external
 */
function isExternalUrl(url, linkBaseURL) {
    if (!linkBaseURL)
        return true;
    try {
        // Use a simple string-based check for Node.js compatibility
        // Extract hostname from URL string
        const urlMatch = url.match(/^https?:\/\/([^\/]+)/);
        const baseMatch = linkBaseURL.match(/^https?:\/\/([^\/]+)/);
        if (urlMatch && baseMatch) {
            return urlMatch[1] !== baseMatch[1];
        }
        return true;
    }
    catch {
        return true;
    }
}
/**
 * Check if URL is a Nostr URL
 */
function isNostrUrl(url) {
    return url.startsWith('nostr:') || getNostrType(url) !== null;
}
/**
 * Check if URL is an image
 */
function isImageUrl(url) {
    return /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(url);
}
/**
 * Check if URL is a video
 */
function isVideoUrl(url) {
    return /\.(mp4|webm|ogg)$/i.test(url);
}
