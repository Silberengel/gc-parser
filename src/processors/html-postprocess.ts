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
 * Converts AsciiDoc macros to HTML with data attributes and CSS classes
 */
export function postProcessHtml(html: string, options: PostProcessOptions = {}): string {
  let processed = html;

  // Convert bookstr markers to HTML placeholders
  processed = processed.replace(/BOOKSTR:([^<>\s]+)/g, (_match, bookContent) => {
    const escaped = bookContent.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return `<span data-bookstr="${escaped}" class="bookstr-placeholder"></span>`;
  });

  // Convert hashtag links to HTML
  processed = processed.replace(/hashtag:([^[]+)\[([^\]]+)\]/g, (_match, normalizedHashtag, displayText) => {
    // HTML escape the display text
    const escapedDisplay = displayText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // If hashtagUrl is configured, make it a clickable link
    if (options.hashtagUrl) {
      let url: string;
      if (typeof options.hashtagUrl === 'function') {
        url = options.hashtagUrl(normalizedHashtag);
      } else {
        // String template with {topic} placeholder
        url = options.hashtagUrl.replace(/{topic}/g, normalizedHashtag);
      }
      
      // Escape URL for HTML attribute
      const escapedUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      
      return `<a class="hashtag-link text-primary-600 dark:text-primary-500 hover:underline" data-topic="${normalizedHashtag.replace(/"/g, '&quot;')}" data-url="${escapedUrl}" href="${escapedUrl}">${escapedDisplay}</a>`;
    } else {
      // Default: Use span instead of <a> tag - same color as links but no underline and not clickable
      return `<span class="hashtag-link">${escapedDisplay}</span>`;
    }
  });

  // Convert WIKILINK:dtag|display placeholder format to HTML
  // Match WIKILINK:dtag|display, ensuring we don't match across HTML tags
  processed = processed.replace(/WIKILINK:([^|<>]+)\|([^<>\s]+)/g, (_match, dTag, displayText) => {
    const escapedDtag = dTag.trim().replace(/"/g, '&quot;');
    const escapedDisplay = displayText.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // Generate URL using custom format or default
    let url: string;
    if (options.wikilinkUrl) {
      if (typeof options.wikilinkUrl === 'function') {
        url = options.wikilinkUrl(dTag.trim());
      } else {
        // String template with {dtag} placeholder
        url = options.wikilinkUrl.replace(/{dtag}/g, dTag.trim());
      }
    } else {
      // Default format
      url = `/events?d=${escapedDtag}`;
    }
    
    // Escape URL for HTML attribute
    const escapedUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    
    return `<a class="wikilink text-primary-600 dark:text-primary-500 hover:underline" data-dtag="${escapedDtag}" data-url="${escapedUrl}" href="${escapedUrl}">${escapedDisplay}</a>`;
  });

  // Convert nostr: links to HTML
  processed = processed.replace(/link:nostr:([^[]+)\[([^\]]+)\]/g, (_match, bech32Id, displayText) => {
    const nostrType = getNostrType(bech32Id);
    
    if (nostrType === 'nevent' || nostrType === 'naddr' || nostrType === 'note') {
      // Render as embedded event placeholder
      const escaped = bech32Id.replace(/"/g, '&quot;');
      return `<div data-embedded-note="${escaped}" class="embedded-note-container">Loading embedded event...</div>`;
    } else if (nostrType === 'npub' || nostrType === 'nprofile') {
      // Render as user handle
      const escaped = bech32Id.replace(/"/g, '&quot;');
      return `<span class="user-handle" data-pubkey="${escaped}">@${displayText}</span>`;
    } else {
      // Fallback to regular link
      const escaped = bech32Id.replace(/"/g, '&quot;');
      return `<a href="nostr:${bech32Id}" class="nostr-link text-blue-600 hover:text-blue-800 hover:underline" data-nostr-type="${nostrType || 'unknown'}" data-bech32="${escaped}">${displayText}</a>`;
    }
  });

  // Convert any leftover link: macros that AsciiDoctor didn't convert
  // This handles cases where AsciiDoctor couldn't parse the link (e.g., link text with special chars)
  // Pattern: link:url[text] where url is http/https and text can contain any characters
  processed = processed.replace(/link:(https?:\/\/[^\[]+)\[([^\]]+)\]/g, (_match, url, text) => {
    // Escape URL and text for HTML attributes
    const escapedUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // Check if link text contains wss:// or ws:// - these are relay URLs, don't add OpenGraph
    const isRelayUrl = /wss?:\/\//i.test(text);
    
    if (isRelayUrl) {
      // Simple link without OpenGraph wrapper
      return `<a href="${escapedUrl}" target="_blank" rel="noreferrer noopener" class="break-words inline-flex items-baseline gap-1">${escapedText} <svg style="width: 0.75rem; height: 0.75rem; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>`;
    } else {
      // Regular link - will be processed by OpenGraph handler if external
      return `<a href="${escapedUrl}" target="_blank" rel="noreferrer noopener" class="break-words inline-flex items-baseline gap-1">${escapedText} <svg style="width: 0.75rem; height: 0.75rem; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>`;
    }
  });

  // Process media URLs (YouTube, Spotify, video, audio)
  processed = processMedia(processed);

  // Process OpenGraph links (external links that should have rich previews)
  processed = processOpenGraphLinks(processed, options.linkBaseURL);

  // Process images: add max-width styling and data attributes
  processed = processImages(processed);

  // Process musical notation if enabled
  if (options.enableMusicalNotation) {
    processed = processMusicalNotation(processed);
  }

  // Clean up any leftover markdown syntax
  processed = cleanupMarkdown(processed);

  // Add styling classes
  processed = addStylingClasses(processed);

  // Hide raw ToC text
  processed = hideRawTocText(processed);

  return processed;
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
 * Process media URLs (YouTube, Spotify, video, audio)
 * Converts MEDIA: placeholders to HTML embeds/players
 */
function processMedia(html: string): string {
  let processed = html;

  // Process YouTube embeds
  processed = processed.replace(/MEDIA:youtube:([a-zA-Z0-9_-]+)/g, (_match, videoId) => {
    const escapedId = videoId.replace(/"/g, '&quot;');
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

  // Process Spotify embeds
  processed = processed.replace(/MEDIA:spotify:(track|album|playlist|artist|episode|show):([a-zA-Z0-9]+)/g, (_match, type, id) => {
    const escapedType = type.replace(/"/g, '&quot;');
    const escapedId = id.replace(/"/g, '&quot;');
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

  // Process video files
  processed = processed.replace(/MEDIA:video:(https?:\/\/[^\s<>"{}|\\^`\[\]()]+)/g, (_match, url) => {
    const escapedUrl = url
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  // Process audio files
  processed = processed.replace(/MEDIA:audio:(https?:\/\/[^\s<>"{}|\\^`\[\]()]+)/g, (_match, url) => {
    const escapedUrl = url
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
 * Process OpenGraph links - mark external links for OpenGraph preview fetching
 */
function processOpenGraphLinks(html: string, linkBaseURL?: string): string {
  // First, clean up any corrupted HTML fragments that might interfere
  // Remove "link:" prefixes that appear before links (AsciiDoc syntax that shouldn't be in HTML)
  // This happens when AsciiDoctor doesn't fully convert link:url[text] syntax or when
  // there's literal text like "should render like link:" before an anchor tag
  let processed = html;
  
  // Remove "link:" that appears immediately before anchor tags (most common case)
  // Match "link:" followed by optional whitespace and then <a
  processed = processed.replace(/link:\s*<a/gi, '<a');
  
  // Remove "link:" that appears as plain text in HTML (shouldn't be there)
  // Be careful not to match "link:" inside HTML attributes or tags
  // Match "link:" that's not inside quotes or tags
  processed = processed.replace(/([^"'>\s])link:([a-zA-Z0-9])/gi, '$1$2');
  
  // Also handle cases where "link:" appears with whitespace before anchor tags
  processed = processed.replace(/\s+link:\s*(?=<a\s+href)/gi, ' ');
  
  // Clean up any corrupted href attributes that contain HTML fragments
  processed = processed.replace(/href\s*=\s*["']([^"']*<[^"']*)["']/gi, (match, corruptedHref) => {
    // If href contains HTML tags, extract just the URL part
    const urlMatch = corruptedHref.match(/(https?:\/\/[^\s<>"']+)/i);
    if (urlMatch) {
      return `href="${urlMatch[1]}"`;
    }
    return match; // If we can't fix it, leave it (will be skipped by validation)
  });
  
  // Clean up any malformed anchor tag fragments that might cause issues
  processed = processed.replace(/<a\s+href=["']([^"'>]*<[^"'>]*)["']/gi, (match, corruptedHref) => {
    // Skip corrupted anchor tags - they'll be handled by the main regex with validation
    return match;
  });
  
  // Clean up links inside code blocks - AsciiDoctor creates them but they should be plain text
  // Remove <a> tags inside <code> blocks, keeping only the link text
  processed = processed.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (match, content) => {
    // Remove any <a> tags inside code blocks, keeping only the text content
    const cleaned = content.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');
    return `<code>${cleaned}</code>`;
  });
  
  // Also clean up links inside pre blocks
  processed = processed.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (match, content) => {
    const cleaned = content.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');
    return `<pre>${cleaned}</pre>`;
  });
  
  // Now protect code blocks and pre blocks by replacing them with placeholders
  const codeBlockPlaceholders: string[] = [];
  const preBlockPlaceholders: string[] = [];
  
  // Replace pre blocks first (they can contain code blocks)
  processed = processed.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (match) => {
    const placeholder = `__PREBLOCK_${preBlockPlaceholders.length}__`;
    preBlockPlaceholders.push(match);
    return placeholder;
  });
  
  // Replace code blocks
  processed = processed.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (match) => {
    const placeholder = `__CODEBLOCK_${codeBlockPlaceholders.length}__`;
    codeBlockPlaceholders.push(match);
    return placeholder;
  });

  // Extract base domain from linkBaseURL if provided
  let baseDomain: string | null = null;
  if (linkBaseURL) {
    try {
      const urlMatch = linkBaseURL.match(/^https?:\/\/([^\/]+)/);
      if (urlMatch) {
        baseDomain = urlMatch[1];
      }
    } catch {
      // Ignore parsing errors
    }
  }
  
  // Before processing, remove any corrupted opengraph containers that might have been created
  // These have malformed data-og-url attributes containing HTML fragments
  // Match all spans with data-og-url and check if they're corrupted
  // Use a pattern that matches spans with data-og-url, then check the attribute value
  processed = processed.replace(/<span[^>]*data-og-url=["']([^"']+)["'][^>]*>[\s\S]*?<\/span>/gi, (match) => {
    // This span has a corrupted data-og-url (contains <)
    // Extract the clean URL from the beginning of the attribute value
    const dataOgUrlMatch = match.match(/data-og-url=["']([^"']+)["']/i);
    if (dataOgUrlMatch && dataOgUrlMatch[1]) {
      // Extract just the URL part (everything before the first <)
      const urlMatch = dataOgUrlMatch[1].match(/(https?:\/\/[^\s<>"']+)/i);
      if (urlMatch) {
        const cleanUrl = urlMatch[1];
        // Extract the link text from inside the span
        const linkMatch = match.match(/<a[^>]*>(.*?)<\/a>/i);
        const linkText = linkMatch ? linkMatch[1] : cleanUrl;
        // Return a clean opengraph container with the fixed URL
        const escapedUrl = cleanUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
      }
      // If we can't extract a clean URL, just remove the corrupted span and keep any text
      const textMatch = match.match(/>([^<]+)</);
      return textMatch ? textMatch[1] : '';
    }
    return match; // Keep valid spans
  });
  
  // Match external links (http/https) that aren't media, nostr, or wikilinks
  // Skip links that are already in media embeds or special containers
  // Use a stricter regex that only matches valid, complete anchor tags
  // The regex must match a complete <a> tag with proper structure
  processed = processed.replace(/<a\s+([^>]*\s+)?href\s*=\s*["'](https?:\/\/[^"']{1,2048})["']([^>]*?)>(.*?)<\/a>/gis, (match, before, href, after, linkText) => {
    // CRITICAL: Validate href FIRST - if it contains ANY HTML tags or fragments, skip immediately
    // This prevents corrupted HTML from being created
    if (!href) {
      return match; // Skip if no href
    }
    
    // Skip if href contains HTML tags or looks corrupted - be very strict
    // Check for common HTML fragments that indicate corruption
    if (href.includes('<') || href.includes('>') || href.includes('href=') || href.includes('</a>') || href.includes('<a') || href.includes('"') || href.includes("'")) {
      return match; // Skip if href looks corrupted
    }
    
    // Additional validation: href should only contain URL-safe characters
    // URLs shouldn't contain unescaped quotes or HTML tags
    if (!/^https?:\/\/[^\s<>"']+$/i.test(href)) {
      return match; // Skip if href doesn't match clean URL pattern
    }
    
    // Validate href is a proper URL (starts with http:// or https:// and doesn't contain invalid chars)
    if (!/^https?:\/\/[^\s<>"']+$/i.test(href)) {
      return match; // Skip if href doesn't match URL pattern
    }
    
    // Skip if the match contains unclosed tags or corrupted HTML
    const openATags = (match.match(/<a\s/g) || []).length;
    const closeATags = (match.match(/<\/a>/g) || []).length;
    if (openATags !== closeATags || openATags !== 1) {
      return match; // Multiple or mismatched <a> tags = corrupted
    }
    
    // Skip if match contains nested HTML that looks corrupted
    if (match.includes('href="') && match.split('href="').length > 2) {
      return match; // Multiple href attributes = corrupted
    }
    
    // Skip if it's already a media embed, nostr link, wikilink, or opengraph link
    if (match.includes('class="wikilink"') || 
        match.includes('class="nostr-link"') ||
        match.includes('class="opengraph-link"') ||
        match.includes('data-embedded-note') ||
        match.includes('youtube-embed') ||
        match.includes('spotify-embed') ||
        match.includes('media-embed') ||
        match.includes('opengraph-link-container')) {
      return match;
    }

    // Skip if it's a media file URL
    if (/\.(mp4|webm|ogg|m4v|mov|avi|mkv|flv|wmv|mp3|m4a|wav|flac|aac|opus|wma|jpeg|jpg|png|gif|webp|svg)$/i.test(href)) {
      return match;
    }

    // Skip if it's YouTube or Spotify (already handled as media)
    if (/youtube\.com|youtu\.be|spotify\.com/i.test(href)) {
      return match;
    }

    // Skip if link text contains wss:// or ws:// - these are relay URLs, not web pages
    // They don't need OpenGraph previews
    if (/wss?:\/\//i.test(linkText)) {
      return match;
    }

    // Check if it's an external link (not same domain)
    let isExternal = true;
    if (baseDomain) {
      try {
        const hrefMatch = href.match(/^https?:\/\/([^\/]+)/);
        if (hrefMatch && hrefMatch[1] === baseDomain) {
          isExternal = false;
        }
      } catch {
        // If parsing fails, assume external
      }
    }

    // Only process external links
    if (!isExternal) {
      return match;
    }

    // Escape the URL for data attribute
    const escapedUrl = href
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    // Add data attribute for OpenGraph fetching and wrap in container
    // The actual OpenGraph fetching will be done client-side via JavaScript
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
  
  // Restore pre blocks
  preBlockPlaceholders.forEach((preBlock, index) => {
    processed = processed.replace(`__PREBLOCK_${index}__`, preBlock);
  });

  return processed;
}

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
    
    updatedAttributes += ` data-asciidoc-image="true" data-image-index="${currentIndex}" data-image-src="${src.replace(/"/g, '&quot;')}"`;
    
    return `<img${updatedAttributes}>`;
  });
}

/**
 * Clean URL by removing tracking parameters
 * Based on jumble's cleanUrl function
 */
function cleanUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    
    // List of tracking parameter prefixes and exact names to remove
    const trackingParams = [
      // Google Analytics & Ads
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
      'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
      
      // Facebook
      'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
      
      // Twitter/X
      'twclid', 'twsrc',
      
      // Microsoft/Bing
      'msclkid', 'mc_cid', 'mc_eid',
      
      // Adobe
      'adobe_mc', 'adobe_mc_ref', 'adobe_mc_sdid',
      
      // Mailchimp
      'mc_cid', 'mc_eid',
      
      // HubSpot
      'hsCtaTracking', 'hsa_acc', 'hsa_cam', 'hsa_grp', 'hsa_ad', 'hsa_src', 'hsa_tgt', 'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver',
      
      // Marketo
      'mkt_tok',
      
      // YouTube
      'si', 'feature', 'kw', 'pp',
      
      // Other common tracking
      'ref', 'referrer', 'source', 'campaign', 'medium', 'content',
      'yclid', 'srsltid', '_ga', '_gl', 'igshid', 'epik', 'pk_campaign', 'pk_kwd',
      
      // Mobile app tracking
      'adjust_tracker', 'adjust_campaign', 'adjust_adgroup', 'adjust_creative',
      
      // Amazon
      'tag', 'linkCode', 'creative', 'creativeASIN', 'linkId', 'ascsubtag',
      
      // Affiliate tracking
      'aff_id', 'affiliate_id', 'aff', 'ref_', 'refer',
      
      // Social media share tracking
      'share', 'shared', 'sharesource'
    ];
    
    // Remove all tracking parameters
    trackingParams.forEach(param => {
      parsedUrl.searchParams.delete(param);
    });
    
    // Remove any parameter that starts with utm_ or _
    Array.from(parsedUrl.searchParams.keys()).forEach(key => {
      if (key.startsWith('utm_') || key.startsWith('_')) {
        parsedUrl.searchParams.delete(key);
      }
    });
    
    return parsedUrl.toString();
  } catch {
    // If URL parsing fails, return original URL
    return url;
  }
}

/**
 * Clean up leftover markdown syntax
 */
function cleanupMarkdown(html: string): string {
  let cleaned = html;

  // Clean up markdown image syntax
  cleaned = cleaned.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const altText = alt || '';
    // Clean URL (remove tracking parameters)
    const cleanedUrl = cleanUrl(url);
    // Escape for HTML attribute
    const escapedUrl = cleanedUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return `<img src="${escapedUrl}" alt="${altText}" class="max-w-[400px] object-contain my-0" />`;
  });

  // Clean up markdown link syntax
  cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
    if (cleaned.includes(`href="${url}"`)) {
      return _match;
    }
    // Clean URL (remove tracking parameters)
    const cleanedUrl = cleanUrl(url);
    // Escape for HTML attribute
    const escapedUrl = cleanedUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    // Escape text for HTML
    const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<a href="${escapedUrl}" target="_blank" rel="noreferrer noopener" class="break-words inline-flex items-baseline gap-1">${escapedText} <svg style="width: 0.75rem; height: 0.75rem; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>`;
  });

  return cleaned;
}

/**
 * Add proper CSS classes for styling
 */
function addStylingClasses(html: string): string {
  let styled = html;
  
  // Add strikethrough styling
  styled = styled.replace(/<span class="line-through">([^<]+)<\/span>/g, '<span class="line-through line-through-2">$1</span>');
  
  // Add subscript styling
  styled = styled.replace(/<span class="subscript">([^<]+)<\/span>/g, '<span class="subscript text-xs align-sub">$1</span>');
  
  // Add superscript styling
  styled = styled.replace(/<span class="superscript">([^<]+)<\/span>/g, '<span class="superscript text-xs align-super">$1</span>');
  
  // Add code highlighting classes
  styled = styled.replace(/<pre class="highlightjs[^"]*">/g, '<pre class="highlightjs hljs">');
  styled = styled.replace(/<code class="highlightjs[^"]*">/g, '<code class="highlightjs hljs">');
  
  return styled;
}

/**
 * Hide raw AsciiDoc ToC text
 */
function hideRawTocText(html: string): string {
  let cleaned = html;

  cleaned = cleaned.replace(
    /<h[1-6][^>]*>.*?Table of Contents.*?\(\d+\).*?<\/h[1-6]>/gi,
    ''
  );

  cleaned = cleaned.replace(
    /<p[^>]*>.*?Table of Contents.*?\(\d+\).*?<\/p>/gi,
    ''
  );

  cleaned = cleaned.replace(
    /<p[^>]*>.*?Assumptions.*?\[n=0\].*?<\/p>/gi,
    ''
  );

  return cleaned;
}
