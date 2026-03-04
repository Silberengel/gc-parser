import { NostrLink, Wikilink } from '../types';

export interface ExtractedMetadata {
  nostrLinks: NostrLink[];
  wikilinks: Wikilink[];
  hashtags: string[];
  links: Array<{ url: string; text: string; isExternal: boolean }>;
  media: string[];
}

/**
 * Extracts metadata from content before processing
 */
export function extractMetadata(content: string, linkBaseURL: string): ExtractedMetadata {
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
function extractNostrLinks(content: string): NostrLink[] {
  const nostrLinks: NostrLink[] = [];
  const seen = new Set<string>();

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
function extractWikilinks(content: string): Wikilink[] {
  const wikilinks: Wikilink[] = [];
  const seen = new Set<string>();

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
function extractHashtags(content: string): string[] {
  const hashtags: string[] = [];
  const seen = new Set<string>();

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
function extractLinks(content: string, linkBaseURL: string): Array<{ url: string; text: string; isExternal: boolean }> {
  const links: Array<{ url: string; text: string; isExternal: boolean }> = [];
  const seen = new Set<string>();

  // Remove code blocks and inline code to avoid matching URLs inside them
  const codeBlockPattern = /```[\s\S]*?```/g;
  const inlineCodePattern = /`[^`]+`/g;
  let processedContent = content
    .replace(codeBlockPattern, '') // Remove code blocks
    .replace(inlineCodePattern, ''); // Remove inline code

  // Extract markdown links: [text](url) - but NOT images ![alt](url)
  // First, extract nested image links: [![alt](image-url)](link-url)
  // These should extract the outer link with the alt text
  // We also need to mark the inner image URL as seen so it doesn't get extracted as a raw URL
  const nestedImageLinkPattern = /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g;
  let nestedMatch;
  const nestedImageUrls = new Set<string>(); // Track inner image URLs to exclude them
  while ((nestedMatch = nestedImageLinkPattern.exec(processedContent)) !== null) {
    const [, altText, imageUrl, linkUrl] = nestedMatch;
    const cleanLinkUrl = linkUrl.trim().replace(/[)\].,;:!?`]+$/, '');
    const cleanImageUrl = imageUrl.trim().replace(/[)\].,;:!?`]+$/, '');
    
    // Mark the inner image URL as seen so it doesn't get extracted as a raw URL
    nestedImageUrls.add(cleanImageUrl);
    // Also mark it in the seen set to prevent it from being extracted as a regular link
    seen.add(cleanImageUrl);
    
    if (cleanLinkUrl && cleanLinkUrl.match(/^https?:\/\//i) && !isNostrUrl(cleanLinkUrl) && !seen.has(cleanLinkUrl)) {
      seen.add(cleanLinkUrl);
      links.push({
        url: cleanLinkUrl,
        text: altText.trim() || 'Image link', // Use the alt text from the image (e.g., "Youtube link with pic")
        isExternal: isExternalUrl(cleanLinkUrl, linkBaseURL),
      });
    }
  }

  // Now extract regular markdown links: [text](url) - but NOT images ![alt](url)
  // Use a pattern that explicitly excludes images by checking before the match
  const markdownLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let markdownMatch;
  while ((markdownMatch = markdownLinkPattern.exec(processedContent)) !== null) {
    // Check if this is an image (preceded by !)
    // We need to check the character immediately before the opening bracket
    const matchIndex = markdownMatch.index;
    if (matchIndex > 0) {
      const charBefore = processedContent[matchIndex - 1];
      if (charBefore === '!') {
        continue; // Skip images - this is ![alt](url), not [text](url)
      }
    }
    
    let [, text, url] = markdownMatch;
    
    // Skip if this is a nested image link (we already extracted those above)
    if (text.trim().startsWith('![') && text.includes('](')) {
      continue; // Already handled by nestedImageLinkPattern
    }
    
    // Handle AsciiDoc image syntax in markdown links: [image::url[alt,width=100%]](link-url)
    // This happens when AsciiDoc content is converted to markdown-style links
    if (text.trim().startsWith('image::') || text.trim().startsWith('image:')) {
      // Match image::url[alt,attributes] or image:url[alt,attributes]
      const imageMatch = text.match(/^image:?:[^\[]+\[([^\],]+)/);
      if (imageMatch) {
        text = imageMatch[1].trim(); // Use just the alt text (e.g., "Youtube link with pic")
      } else {
        // If we can't extract alt text, use a default
        text = 'Image link';
      }
    }
    
    // Clean up URL - remove trailing punctuation that might have been captured
    // But preserve parentheses that are part of the URL (like in query strings)
    // Only remove trailing punctuation that's clearly not part of the URL
    url = url.trim();
    
    // Remove trailing punctuation that's likely not part of the URL
    // But be careful - URLs can end with ) if they're in markdown like [text](url))
    // We'll be conservative and only remove if it's clearly punctuation
    url = url.replace(/[)\].,;:!?`]+$/, '');
    
    // Clean up text - remove stray punctuation and whitespace
    text = text.trim();
    
    // Skip if URL is empty or invalid
    if (!url || !url.match(/^https?:\/\//i)) {
      continue;
    }
    
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
  // Handle nested image links: link:url[image::image-url[alt,width=100%]]
  const asciidocLinkPattern = /link:([^\[]+)\[([^\]]+)\]/g;
  let asciidocMatch;
  while ((asciidocMatch = asciidocLinkPattern.exec(processedContent)) !== null) {
    let [, url, text] = asciidocMatch;
    
    // Clean up URL
    url = url.trim();
    
    // Handle nested image syntax in AsciiDoc: image::url[alt,width=100%]
    // Extract just the alt text from the image syntax
    if (text.trim().startsWith('image::') || text.trim().startsWith('image:')) {
      // Match image::url[alt,attributes] or image:url[alt,attributes]
      const imageMatch = text.match(/^image:?:[^\[]+\[([^\],]+)/);
      if (imageMatch) {
        text = imageMatch[1].trim(); // Use just the alt text
      } else {
        // If we can't extract alt text, skip this link (it's an image, not a text link)
        continue;
      }
    }
    
    // Clean up text
    text = text.trim();
    
    // Skip if URL is empty or invalid
    if (!url || !url.match(/^https?:\/\//i)) {
      continue;
    }
    
    if (!seen.has(url) && !isNostrUrl(url)) {
      seen.add(url);
      links.push({
        url,
        text,
        isExternal: isExternalUrl(url, linkBaseURL),
      });
    }
  }

  // Extract raw URLs (basic pattern) - but exclude those already in markdown/asciidoc links
  // More restrictive pattern to avoid capturing trailing punctuation
  const urlPattern = /https?:\/\/[^\s<>"'`()\[\]]+/g;
  const rawUrls = processedContent.match(urlPattern) || [];
  rawUrls.forEach(url => {
    // Remove trailing punctuation that might have been captured
    url = url.replace(/[)\].,;:!?`]+$/, '');
    
    // Skip if URL is too short or invalid
    if (!url || url.length < 10 || !url.match(/^https?:\/\/[^\s]+$/i)) {
      return;
    }
    
    // Skip if this is an inner image URL from a nested image link
    if (nestedImageUrls.has(url)) {
      return;
    }
    
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
function extractMedia(content: string): string[] {
  const media: string[] = [];
  const seen = new Set<string>();

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
function getNostrType(id: string): 'npub' | 'nprofile' | 'nevent' | 'naddr' | 'note' | null {
  if (id.startsWith('npub')) return 'npub';
  if (id.startsWith('nprofile')) return 'nprofile';
  if (id.startsWith('nevent')) return 'nevent';
  if (id.startsWith('naddr')) return 'naddr';
  if (id.startsWith('note')) return 'note';
  return null;
}

/**
 * Normalize text to d-tag format
 */
function normalizeDtag(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Check if URL is external
 */
function isExternalUrl(url: string, linkBaseURL: string): boolean {
  if (!linkBaseURL) return true;
  try {
    // Use a simple string-based check for Node.js compatibility
    // Extract hostname from URL string
    const urlMatch = url.match(/^https?:\/\/([^\/]+)/);
    const baseMatch = linkBaseURL.match(/^https?:\/\/([^\/]+)/);
    
    if (urlMatch && baseMatch) {
      return urlMatch[1] !== baseMatch[1];
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Check if URL is a Nostr URL
 */
function isNostrUrl(url: string): boolean {
  return url.startsWith('nostr:') || getNostrType(url) !== null;
}

/**
 * Check if URL is an image
 */
function isImageUrl(url: string): boolean {
  return /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(url);
}

/**
 * Check if URL is a video
 */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)$/i.test(url);
}
