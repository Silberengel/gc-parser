import { processMusicalNotation } from './music';

export interface PostProcessOptions {
  enableMusicalNotation?: boolean;
  linkBaseURL?: string;
  /** Custom URL format for wikilinks */
  wikilinkUrl?: string | ((dtag: string) => string);
  /** Custom URL format for hashtags */
  hashtagUrl?: string | ((topic: string) => string);
}

/**
 * Post-processes HTML output from AsciiDoctor
 * 
 * Processing order (critical for correct rendering):
 * 1. Convert placeholders to HTML (BOOKSTR, hashtags, wikilinks, nostr links, media, link macros)
 * 2. Fix corrupted HTML (double-escaped quotes, escaped HTML as text, broken links)
 * 3. Process OpenGraph links (external links with previews)
 * 4. Process images (add styling)
 * 5. Process musical notation
 * 6. Clean up leftover markdown syntax
 * 7. Add styling classes
 * 8. Hide raw ToC text
 */
export function postProcessHtml(html: string, options: PostProcessOptions = {}): string {
  let processed = html;

  // ============================================
  // STEP 1: Convert placeholders to HTML
  // ============================================
  processed = convertBookstrMarkers(processed);
  processed = convertHashtags(processed, options);
  processed = convertWikilinks(processed, options);
  processed = convertNostrLinks(processed);
  processed = convertMediaPlaceholders(processed);
  processed = convertLinkMacros(processed);

  // ============================================
  // STEP 2: Fix corrupted HTML
  // ============================================
  processed = fixDoubleEscapedQuotes(processed);
  processed = fixEscapedHtmlLinks(processed);
  processed = fixBrokenLinkPatterns(processed);

  // ============================================
  // STEP 3: Process OpenGraph links
  // ============================================
  processed = processOpenGraphLinks(processed, options.linkBaseURL);

  // ============================================
  // STEP 4: Process images
  // ============================================
  processed = processImages(processed);

  // ============================================
  // STEP 5: Process musical notation
  // ============================================
  if (options.enableMusicalNotation) {
    processed = processMusicalNotation(processed);
  }

  // ============================================
  // STEP 6: Clean up leftover markdown
  // ============================================
  processed = cleanupMarkdown(processed);

  // ============================================
  // STEP 7: Add styling classes
  // ============================================
  processed = addStylingClasses(processed);

  // ============================================
  // STEP 8: Hide raw ToC text
  // ============================================
  processed = hideRawTocText(processed);

  return processed;
}

// ============================================
// STEP 1: Convert placeholders to HTML
// ============================================

/**
 * Convert BOOKSTR markers to HTML placeholders
 */
function convertBookstrMarkers(html: string): string {
  return html.replace(/BOOKSTR:([^<>\s]+)/g, (_match, bookContent) => {
    const escaped = escapeHtmlAttr(bookContent);
    return `<span data-bookstr="${escaped}" class="bookstr-placeholder"></span>`;
  });
}

/**
 * Convert hashtag placeholders to HTML
 */
function convertHashtags(html: string, options: PostProcessOptions): string {
  return html.replace(/hashtag:([^[]+)\[([^\]]+)\]/g, (_match, normalizedHashtag, displayText) => {
    const escapedDisplay = escapeHtml(displayText);
    
    if (options.hashtagUrl) {
      let url: string;
      if (typeof options.hashtagUrl === 'function') {
        url = options.hashtagUrl(normalizedHashtag);
      } else {
        url = options.hashtagUrl.replace(/{topic}/g, normalizedHashtag);
      }
      
      const escapedUrl = escapeHtmlAttr(url);
      const escapedTopic = escapeHtmlAttr(normalizedHashtag);
      
      return `<a class="hashtag-link text-primary-600 dark:text-primary-500 hover:underline" data-topic="${escapedTopic}" data-url="${escapedUrl}" href="${escapedUrl}">${escapedDisplay}</a>`;
    } else {
      return `<span class="hashtag-link">${escapedDisplay}</span>`;
    }
  });
}

/**
 * Convert wikilink placeholders to HTML
 */
function convertWikilinks(html: string, options: PostProcessOptions): string {
  return html.replace(/WIKILINK:([^|<>]+)\|([^<>\s]+)/g, (_match, dTag, displayText) => {
    const escapedDtag = escapeHtmlAttr(dTag.trim());
    const escapedDisplay = escapeHtml(displayText.trim());
    
    let url: string;
    if (options.wikilinkUrl) {
      if (typeof options.wikilinkUrl === 'function') {
        url = options.wikilinkUrl(dTag.trim());
      } else {
        url = options.wikilinkUrl.replace(/{dtag}/g, dTag.trim());
      }
    } else {
      url = `/events?d=${escapedDtag}`;
    }
    
    const escapedUrl = escapeHtmlAttr(url);
    
    return `<a class="wikilink text-primary-600 dark:text-primary-500 hover:underline" data-dtag="${escapedDtag}" data-url="${escapedUrl}" href="${escapedUrl}">${escapedDisplay}</a>`;
  });
}

/**
 * Convert nostr: links to HTML
 */
function convertNostrLinks(html: string): string {
  return html.replace(/link:nostr:([^[]+)\[([^\]]+)\]/g, (_match, bech32Id, displayText) => {
    const nostrType = getNostrType(bech32Id);
    const escaped = escapeHtmlAttr(bech32Id);
    const escapedDisplay = escapeHtml(displayText);
    
    if (nostrType === 'nevent' || nostrType === 'naddr' || nostrType === 'note') {
      return `<div data-embedded-note="${escaped}" class="embedded-note-container">Loading embedded event...</div>`;
    } else if (nostrType === 'npub' || nostrType === 'nprofile') {
      return `<span class="user-handle" data-pubkey="${escaped}">@${escapedDisplay}</span>`;
    } else {
      return `<a href="nostr:${bech32Id}" class="nostr-link text-blue-600 hover:text-blue-800 hover:underline" data-nostr-type="${nostrType || 'unknown'}" data-bech32="${escaped}">${escapedDisplay}</a>`;
    }
  });
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
 * Convert media placeholders to HTML embeds
 */
function convertMediaPlaceholders(html: string): string {
  let processed = html;

  // YouTube embeds
  processed = processed.replace(/MEDIA:youtube:([a-zA-Z0-9_-]+)/g, (_match, videoId) => {
    const escapedId = escapeHtmlAttr(videoId);
    return `<div class="media-embed youtube-embed" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1rem 0;">
      <iframe 
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
        src="https://www.youtube.com/embed/${escapedId}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen
        loading="lazy">
      </iframe>
    </div>`;
  });

  // Spotify embeds
  processed = processed.replace(/MEDIA:spotify:(track|album|playlist|artist|episode|show):([a-zA-Z0-9]+)/g, (_match, type, id) => {
    const escapedType = escapeHtmlAttr(type);
    const escapedId = escapeHtmlAttr(id);
    return `<div class="media-embed spotify-embed" style="margin: 1rem 0;">
      <iframe 
        style="border-radius: 12px; width: 100%; max-width: 100%;" 
        src="https://open.spotify.com/embed/${escapedType}/${escapedId}?utm_source=generator" 
        width="100%" 
        height="352" 
        frameborder="0" 
        allowfullscreen="" 
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
        loading="lazy">
      </iframe>
    </div>`;
  });

  // Video files
  processed = processed.replace(/MEDIA:video:(https?:\/\/[^\s<>"{}|\\^`\[\]()]+)/g, (_match, url) => {
    const escapedUrl = escapeHtmlAttr(url);
    return `<div class="media-embed video-embed" style="margin: 1rem 0;">
      <video 
        controls 
        preload="metadata" 
        style="width: 100%; max-width: 100%; height: auto; border-radius: 8px;"
        class="media-player">
        <source src="${escapedUrl}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
    </div>`;
  });

  // Audio files
  processed = processed.replace(/MEDIA:audio:(https?:\/\/[^\s<>"{}|\\^`\[\]()]+)/g, (_match, url) => {
    const escapedUrl = escapeHtmlAttr(url);
    return `<div class="media-embed audio-embed" style="margin: 1rem 0;">
      <audio 
        controls 
        preload="metadata" 
        style="width: 100%; max-width: 100%;"
        class="media-player">
        <source src="${escapedUrl}">
        Your browser does not support the audio tag.
      </audio>
    </div>`;
  });

  return processed;
}

/**
 * Convert link: macros that AsciiDoctor didn't convert
 * This handles cases where AsciiDoctor couldn't parse the link (e.g., link text with special chars)
 */
function convertLinkMacros(html: string): string {
  return html.replace(/link:(https?:\/\/[^\[]+)\[([^\]]+)\]/g, (_match, url, text) => {
    // Unescape if already HTML-escaped
    const unescapedUrl = unescapeHtml(url);
    const unescapedText = unescapeHtml(text);
    
    // Re-escape properly for HTML
    const escapedUrl = escapeHtmlAttr(unescapedUrl);
    const escapedText = escapeHtml(unescapedText);
    
    // Check if link text contains wss:// or ws:// - these are relay URLs, don't add OpenGraph
    const isRelayUrl = /wss?:\/\//i.test(unescapedText);
    
    // Create link (OpenGraph processing will handle it later if needed)
    return `<a href="${escapedUrl}" target="_blank" rel="noreferrer noopener" class="break-words inline-flex items-baseline gap-1">${escapedText} <svg style="width: 0.75rem; height: 0.75rem; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>`;
  });
}

// ============================================
// STEP 2: Fix corrupted HTML
// ============================================

/**
 * Fix double-escaped quotes in href attributes: href="&quot;url&quot;" -> href="url"
 */
function fixDoubleEscapedQuotes(html: string): string {
  return html.replace(/href\s*=\s*["']&quot;(https?:\/\/[^"']+)&quot;["']/gi, (_match, url) => {
    const escapedUrl = escapeHtmlAttr(url);
    return `href="${escapedUrl}"`;
  });
}

/**
 * Fix escaped HTML links: &lt;a href="..."&gt;text&lt;/a&gt; -> <a href="...">text</a>
 */
function fixEscapedHtmlLinks(html: string): string {
  return html.replace(/&lt;a\s+href=["'](https?:\/\/[^"']+)["']\s*&gt;([^<]+)&lt;\/a&gt;/gi, (_match, url, text) => {
    const unescapedUrl = unescapeHtml(url);
    const unescapedText = unescapeHtml(text);
    
    const escapedUrl = escapeHtmlAttr(unescapedUrl);
    const escapedText = escapeHtml(unescapedText);
    
    const isRelayUrl = /wss?:\/\//i.test(unescapedText);
    
    return `<a href="${escapedUrl}" target="_blank" rel="noreferrer noopener" class="break-words inline-flex items-baseline gap-1">${escapedText} <svg style="width: 0.75rem; height: 0.75rem; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>`;
  });
}

/**
 * Fix broken link patterns where attributes appear as text before escaped HTML
 * Pattern: " target=...&gt;&lt;a href=...&gt;text&lt;/a&gt;
 */
function fixBrokenLinkPatterns(html: string): string {
  return html.replace(/"\s+target=["'][^"']*["']\s+rel=["'][^"']*["']\s+class=["'][^"']*["']\s*&gt;&lt;a\s+href=["'](https?:\/\/[^"']+)["']\s*&gt;([^<]+)&lt;\/a&gt;/gi, (_match, url, text) => {
    const unescapedUrl = unescapeHtml(url);
    const unescapedText = unescapeHtml(text);
    
    const escapedUrl = escapeHtmlAttr(unescapedUrl);
    const escapedText = escapeHtml(unescapedText);
    
    const isRelayUrl = /wss?:\/\//i.test(unescapedText);
    
    return `<a href="${escapedUrl}" target="_blank" rel="noreferrer noopener" class="break-words inline-flex items-baseline gap-1">${escapedText} <svg style="width: 0.75rem; height: 0.75rem; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>`;
  });
}

// ============================================
// STEP 3: Process OpenGraph links
// ============================================

/**
 * Process OpenGraph links - mark external links for OpenGraph preview fetching
 */
function processOpenGraphLinks(html: string, linkBaseURL?: string): string {
  let processed = html;
  
  // Remove "link:" prefixes that might appear before anchor tags
  processed = processed.replace(/link:\s*<a/gi, '<a');
  processed = processed.replace(/([^"'>\s])link:([a-zA-Z0-9])/gi, '$1$2');
  processed = processed.replace(/\s+link:\s*(?=<a\s+href)/gi, ' ');
  
  // Clean up corrupted href attributes
  processed = processed.replace(/href\s*=\s*["']([^"']*<[^"']*)["']/gi, (match, corruptedHref) => {
    const urlMatch = corruptedHref.match(/(https?:\/\/[^\s<>"']+)/i);
    if (urlMatch) {
      const escapedUrl = escapeHtmlAttr(urlMatch[1]);
      return `href="${escapedUrl}"`;
    }
    return match;
  });
  
  // Protect code blocks and pre blocks
  const codeBlockPlaceholders: string[] = [];
  const preBlockPlaceholders: string[] = [];
  
  processed = processed.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (match) => {
    const placeholder = `__PREBLOCK_${preBlockPlaceholders.length}__`;
    preBlockPlaceholders.push(match);
    return placeholder;
  });
  
  processed = processed.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (match) => {
    const placeholder = `__CODEBLOCK_${codeBlockPlaceholders.length}__`;
    codeBlockPlaceholders.push(match);
    return placeholder;
  });
  
  // Extract base domain
  let baseDomain: string | null = null;
  if (linkBaseURL) {
    const urlMatch = linkBaseURL.match(/^https?:\/\/([^\/]+)/);
    if (urlMatch) {
      baseDomain = urlMatch[1];
    }
  }
  
  // Process external links
  processed = processed.replace(/<a\s+([^>]*\s+)?href\s*=\s*["'](https?:\/\/[^"']{1,2048})["']([^>]*?)>(.*?)<\/a>/gis, (match, before, href, after, linkText) => {
    // Validate href
    if (!href || href.includes('<') || href.includes('>') || !/^https?:\/\/[^\s<>"']+$/i.test(href)) {
      return match;
    }
    
    // Skip if already processed
    if (match.includes('class="wikilink"') || 
        match.includes('class="nostr-link"') ||
        match.includes('class="opengraph-link"') ||
        match.includes('data-embedded-note') ||
        match.includes('media-embed') ||
        match.includes('opengraph-link-container')) {
      return match;
    }
    
    // Skip media files
    if (/\.(mp4|webm|ogg|m4v|mov|avi|mkv|flv|wmv|mp3|m4a|wav|flac|aac|opus|wma|jpeg|jpg|png|gif|webp|svg)$/i.test(href)) {
      return match;
    }
    
    // Skip YouTube/Spotify (already handled as media)
    if (/youtube\.com|youtu\.be|spotify\.com/i.test(href)) {
      return match;
    }
    
    // Skip if link text contains wss:// or ws:// - these are relay URLs, not web pages
    if (/wss?:\/\//i.test(linkText)) {
      return match;
    }
    
    // Check if external
    let isExternal = true;
    if (baseDomain) {
      const hrefMatch = href.match(/^https?:\/\/([^\/]+)/);
      if (hrefMatch && hrefMatch[1] === baseDomain) {
        isExternal = false;
      }
    }
    
    if (!isExternal) {
      return match;
    }
    
    // Wrap in OpenGraph container
    const escapedUrl = escapeHtmlAttr(href);
    return `<span class="opengraph-link-container" data-og-url="${escapedUrl}">
      <a href="${escapedUrl}" target="_blank" rel="noreferrer noopener" class="opengraph-link break-words inline-flex items-baseline gap-1">${linkText} <svg style="width: 0.75rem; height: 0.75rem; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>
      <div class="opengraph-preview" data-og-loading="true" style="display: none;">
        <div class="opengraph-card">
          <div class="opengraph-image-container">
            <img class="opengraph-image" src="" alt="" style="display: none;" />
          </div>
          <div class="opengraph-content">
            <div class="opengraph-site"></div>
            <div class="opengraph-title"></div>
            <div class="opengraph-description"></div>
          </div>
        </div>
      </div>
    </span>`;
  });
  
  // Restore code blocks
  codeBlockPlaceholders.forEach((codeBlock, index) => {
    processed = processed.replace(`__CODEBLOCK_${index}__`, codeBlock);
  });
  
  preBlockPlaceholders.forEach((preBlock, index) => {
    processed = processed.replace(`__PREBLOCK_${index}__`, preBlock);
  });
  
  return processed;
}

// ============================================
// STEP 4: Process images
// ============================================

/**
 * Process images: add max-width styling and data attributes
 */
function processImages(html: string): string {
  const imageUrls: string[] = [];
  const imageUrlRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  
  while ((match = imageUrlRegex.exec(html)) !== null) {
    const url = match[1];
    if (url && !imageUrls.includes(url)) {
      imageUrls.push(url);
    }
  }

  return html.replace(/<img([^>]+)>/gi, (imgTag, attributes) => {
    const srcMatch = attributes.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) return imgTag;
    
    const src = srcMatch[1];
    const currentIndex = imageUrls.indexOf(src);
    
    let updatedAttributes = attributes;
    
    if (updatedAttributes.match(/class=["']/i)) {
      updatedAttributes = updatedAttributes.replace(/class=["']([^"']*)["']/i, (_match: string, classes: string) => {
        const cleanedClasses = classes.replace(/max-w-\[?[^\s\]]+\]?/g, '').trim();
        const newClasses = cleanedClasses 
          ? `${cleanedClasses} max-w-[400px] object-contain cursor-zoom-in`
          : 'max-w-[400px] object-contain cursor-zoom-in';
        return `class="${newClasses}"`;
      });
    } else {
      updatedAttributes += ` class="max-w-[400px] h-auto object-contain cursor-zoom-in"`;
    }
    
    updatedAttributes += ` data-asciidoc-image="true" data-image-index="${currentIndex}" data-image-src="${escapeHtmlAttr(src)}"`;
    
    return `<img${updatedAttributes}>`;
  });
}

// ============================================
// STEP 6: Clean up leftover markdown
// ============================================

/**
 * Clean up leftover markdown syntax
 */
function cleanupMarkdown(html: string): string {
  let cleaned = html;

  // Clean up markdown image syntax
  cleaned = cleaned.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const altText = alt || '';
    const escapedUrl = escapeHtmlAttr(url);
    return `<img src="${escapedUrl}" alt="${altText}" class="max-w-[400px] object-contain my-0" />`;
  });

  // Clean up markdown link syntax (skip if already HTML)
  cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
    // Skip if already processed
    if (cleaned.includes(`href="${url}"`) || cleaned.includes(`href='${url}'`)) {
      return _match;
    }
    
    if (text.includes('&lt;') || text.includes('&gt;') || text.includes('&amp;')) {
      return _match;
    }
    
    const escapedUrl = escapeHtmlAttr(url);
    const escapedText = escapeHtml(text);
    
    return `<a href="${escapedUrl}" target="_blank" rel="noreferrer noopener" class="break-words inline-flex items-baseline gap-1">${escapedText} <svg style="width: 0.75rem; height: 0.75rem; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>`;
  });

  return cleaned;
}

// ============================================
// STEP 7: Add styling classes
// ============================================

/**
 * Add proper CSS classes for styling
 */
function addStylingClasses(html: string): string {
  let styled = html;
  
  styled = styled.replace(/<span class="line-through">([^<]+)<\/span>/g, '<span class="line-through line-through-2">$1</span>');
  styled = styled.replace(/<span class="subscript">([^<]+)<\/span>/g, '<span class="subscript text-xs align-sub">$1</span>');
  styled = styled.replace(/<span class="superscript">([^<]+)<\/span>/g, '<span class="superscript text-xs align-super">$1</span>');
  styled = styled.replace(/<pre class="highlightjs[^"]*">/g, '<pre class="highlightjs hljs">');
  styled = styled.replace(/<code class="highlightjs[^"]*">/g, '<code class="highlightjs hljs">');
  
  return styled;
}

// ============================================
// STEP 8: Hide raw ToC text
// ============================================

/**
 * Hide raw AsciiDoc ToC text
 */
function hideRawTocText(html: string): string {
  let cleaned = html;

  cleaned = cleaned.replace(/<h[1-6][^>]*>.*?Table of Contents.*?\(\d+\).*?<\/h[1-6]>/gi, '');
  cleaned = cleaned.replace(/<p[^>]*>.*?Table of Contents.*?\(\d+\).*?<\/p>/gi, '');
  cleaned = cleaned.replace(/<p[^>]*>.*?Assumptions.*?\[n=0\].*?<\/p>/gi, '');

  return cleaned;
}

// ============================================
// Utility functions
// ============================================

/**
 * Escape HTML content
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape HTML attribute value
 */
function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Unescape HTML entities
 */
function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
