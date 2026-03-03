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

  // Extract nostr: prefixed links
  const nostrMatches = content.match(/nostr:([a-z0-9]+[a-z0-9]{6,})/g) || [];
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
 */
function extractHashtags(content: string): string[] {
  const hashtags: string[] = [];
  const seen = new Set<string>();

  // Extract hashtags: #hashtag
  const hashtagMatches = content.match(/#([a-zA-Z0-9_]+)/g) || [];
  hashtagMatches.forEach(match => {
    const tag = match.substring(1).toLowerCase();
    if (!seen.has(tag)) {
      hashtags.push(tag);
      seen.add(tag);
    }
  });

  return hashtags;
}

/**
 * Extract regular links from content
 */
function extractLinks(content: string, linkBaseURL: string): Array<{ url: string; text: string; isExternal: boolean }> {
  const links: Array<{ url: string; text: string; isExternal: boolean }> = [];
  const seen = new Set<string>();

  // Extract markdown links: [text](url)
  const markdownLinks = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
  markdownLinks.forEach(match => {
    const linkMatch = match.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const [, text, url] = linkMatch;
      if (!seen.has(url) && !isNostrUrl(url)) {
        seen.add(url);
        links.push({
          url,
          text,
          isExternal: isExternalUrl(url, linkBaseURL),
        });
      }
    }
  });

  // Extract asciidoc links: link:url[text]
  const asciidocLinks = content.match(/link:([^\[]+)\[([^\]]+)\]/g) || [];
  asciidocLinks.forEach(match => {
    const linkMatch = match.match(/link:([^\[]+)\[([^\]]+)\]/);
    if (linkMatch) {
      const [, url, text] = linkMatch;
      if (!seen.has(url) && !isNostrUrl(url)) {
        seen.add(url);
        links.push({
          url,
          text,
          isExternal: isExternalUrl(url, linkBaseURL),
        });
      }
    }
  });

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
function extractMedia(content: string): string[] {
  const media: string[] = [];
  const seen = new Set<string>();

  // Extract markdown images: ![alt](url)
  const imageMatches = content.match(/!\[[^\]]*\]\(([^)]+)\)/g) || [];
  imageMatches.forEach(match => {
    const url = match.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1];
    if (url && !seen.has(url)) {
      if (isImageUrl(url) || isVideoUrl(url)) {
        media.push(url);
        seen.add(url);
      }
    }
  });

  // Extract asciidoc images: image::url[alt]
  const asciidocImageMatches = content.match(/image::([^\[]+)\[/g) || [];
  asciidocImageMatches.forEach(match => {
    const url = match.match(/image::([^\[]+)\[/)?.[1];
    if (url && !seen.has(url)) {
      if (isImageUrl(url) || isVideoUrl(url)) {
        media.push(url);
        seen.add(url);
      }
    }
  });

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
