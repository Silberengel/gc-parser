import { ParserOptions, NostrLink, Wikilink } from './types';

/**
 * Extract and process wikilinks, hashtags, and nostr: addresses from HTML
 */
export interface PostProcessResult {
  html: string;
  nostrLinks: NostrLink[];
  wikilinks: Wikilink[];
  hashtags: string[];
}

/**
 * Post-process HTML to convert wikilinks, hashtags, and nostr: addresses
 * @param skipWikilinksAndHashtags - If true, skip processing wikilinks and hashtags (already processed)
 */
export function postProcess(html: string, options: ParserOptions, skipWikilinksAndHashtags: boolean = false): PostProcessResult {
  let processed = html;
  const nostrLinks: NostrLink[] = [];
  const wikilinks: Wikilink[] = [];
  const hashtags: string[] = [];

  // First, mark code blocks to avoid processing inside them
  const codeBlockMarkers: Array<{ start: number; end: number }> = [];
  const codeBlockRegex = /<(pre|code)[^>]*>[\s\S]*?<\/\1>/gi;
  let match;
  while ((match = codeBlockRegex.exec(html)) !== null) {
    codeBlockMarkers.push({ start: match.index, end: match.index + match[0].length });
  }

  function isInCodeBlock(index: number): boolean {
    return codeBlockMarkers.some(marker => index >= marker.start && index < marker.end);
  }

  // Process nostr: addresses (but not in code blocks)
  if (options.enableNostrAddresses !== false) {
    const nostrRegex = /nostr:([np][a-z0-9]+1[a-z0-9]+)/gi;
    const replacements: Array<{ match: string; replacement: string; index: number }> = [];
    
    while ((match = nostrRegex.exec(processed)) !== null) {
      if (isInCodeBlock(match.index)) continue;
      
      const bech32 = match[1];
      const type = getNostrType(bech32);
      if (!type) continue;

      const link: NostrLink = {
        type,
        id: bech32,
        text: match[0],
        bech32: bech32
      };
      nostrLinks.push(link);

      const url = options.linkBaseURL 
        ? `${options.linkBaseURL}/nostr/${bech32}`
        : `#nostr-${bech32}`;
      
      replacements.push({
        match: match[0],
        replacement: `<a href="${escapeHtml(url)}" class="nostr-link" data-nostr-type="${type}" data-nostr-id="${escapeHtml(bech32)}">${escapeHtml(match[0])}</a>`,
        index: match.index
      });
    }

    // Apply replacements in reverse order to preserve indices
    replacements.reverse().forEach(({ match, replacement, index }) => {
      processed = processed.substring(0, index) + replacement + processed.substring(index + match.length);
    });
  }

  // Process wikilinks: [[dtag]] or [[dtag|display]] (but not in code blocks)
  // Skip if already processed (for AsciiDoc)
  if (!skipWikilinksAndHashtags) {
    const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
    const wikilinkReplacements: Array<{ match: string; replacement: string; index: number }> = [];
    
    while ((match = wikilinkRegex.exec(processed)) !== null) {
      if (isInCodeBlock(match.index)) continue;
      
      // Skip if already inside a link tag
      const beforeMatch = processed.substring(0, match.index);
      const lastOpenTag = beforeMatch.lastIndexOf('<a');
      const lastCloseTag = beforeMatch.lastIndexOf('</a>');
      if (lastOpenTag > lastCloseTag) continue; // Inside a link
      
      const content = match[1];
      const parts = content.split('|');
      const dtag = parts[0].trim();
      const display = parts.length > 1 ? parts.slice(1).join('|').trim() : dtag;

      const wikilink: Wikilink = {
        dtag,
        display,
        original: match[0]
      };
      wikilinks.push(wikilink);

      let url: string;
      if (typeof options.wikilinkUrl === 'function') {
        url = options.wikilinkUrl(dtag);
      } else if (typeof options.wikilinkUrl === 'string') {
        url = options.wikilinkUrl.replace('{dtag}', encodeURIComponent(dtag));
      } else {
        url = options.linkBaseURL 
          ? `${options.linkBaseURL}/events?d=${encodeURIComponent(dtag)}`
          : `#${encodeURIComponent(dtag)}`;
      }

      wikilinkReplacements.push({
        match: match[0],
        replacement: `<a href="${escapeHtml(url)}" class="wikilink" data-dtag="${escapeHtml(dtag)}">${escapeHtml(display)}</a>`,
        index: match.index
      });
    }

    // Apply wikilink replacements in reverse order
    wikilinkReplacements.reverse().forEach(({ match, replacement, index }) => {
      processed = processed.substring(0, index) + replacement + processed.substring(index + match.length);
    });

    // Process hashtags: #hashtag (but not in code blocks or inside HTML tags)
    // Match hashtag at start of string, after whitespace, after >, or immediately after opening tags
    const hashtagRegex = /(#[\w-]+)/g;
    const hashtagReplacements: Array<{ match: string; replacement: string; index: number }> = [];
    
    while ((match = hashtagRegex.exec(processed)) !== null) {
      if (isInCodeBlock(match.index)) continue;
      
      // Check if we're inside an HTML tag
      const beforeMatch = processed.substring(0, match.index);
      const lastOpenTag = beforeMatch.lastIndexOf('<');
      const lastCloseTag = beforeMatch.lastIndexOf('>');
      if (lastOpenTag > lastCloseTag) continue; // Inside a tag
      
      // Skip if already inside a link or span
      const lastLinkOpen = beforeMatch.lastIndexOf('<a');
      const lastLinkClose = beforeMatch.lastIndexOf('</a>');
      const lastSpanOpen = beforeMatch.lastIndexOf('<span');
      const lastSpanClose = beforeMatch.lastIndexOf('</span>');
      if (lastLinkOpen > lastLinkClose || lastSpanOpen > lastSpanClose) continue;
      
      // Check what's before the hashtag
      const charBefore = match.index > 0 ? processed[match.index - 1] : '';
      const beforeHashtag = processed.substring(Math.max(0, match.index - 100), match.index);
      const lastTagClose = beforeHashtag.lastIndexOf('>');
      const textAfterTag = beforeHashtag.substring(lastTagClose + 1);
      
      // Hashtag is valid if:
      // 1. At start of string
      // 2. Preceded by whitespace
      // 3. Preceded by >
      // 4. Immediately after opening tag (like <p>#hashtag)
      const isValidPosition = 
        match.index === 0 ||
        /\s/.test(charBefore) ||
        charBefore === '>' ||
        (lastTagClose >= 0 && /^[\s\n]*$/.test(textAfterTag));
      
      if (!isValidPosition) continue;
      
      const hashtag = match[1];
      const topic = hashtag.substring(1);
      const prefix = (match.index === 0 || charBefore === '>' || (lastTagClose >= 0 && /^[\s\n]*$/.test(textAfterTag))) 
        ? '' 
        : charBefore;
      
      if (!hashtags.includes(topic)) {
        hashtags.push(topic);
      }

      let url: string | undefined;
      if (typeof options.hashtagUrl === 'function') {
        url = options.hashtagUrl(topic);
      } else if (typeof options.hashtagUrl === 'string') {
        url = options.hashtagUrl.replace('{topic}', encodeURIComponent(topic));
      }

      const replacement = url
        ? `${prefix}<a href="${escapeHtml(url)}" class="hashtag" data-topic="${escapeHtml(topic)}">${escapeHtml(hashtag)}</a>`
        : `${prefix}<span class="hashtag" data-topic="${escapeHtml(topic)}">${escapeHtml(hashtag)}</span>`;
      
      hashtagReplacements.push({
        match: match[0],
        replacement,
        index: match.index
      });
    }

    // Apply hashtag replacements in reverse order
    hashtagReplacements.reverse().forEach(({ match, replacement, index }) => {
      processed = processed.substring(0, index) + replacement + processed.substring(index + match.length);
    });
  }
  
  // Extract wikilinks and hashtags from already-processed HTML (for AsciiDoc)
  if (skipWikilinksAndHashtags) {
    // Extract wikilinks from existing links
    const wikilinkLinkRegex = /<a[^>]+class="wikilink"[^>]+data-dtag="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    while ((match = wikilinkLinkRegex.exec(processed)) !== null) {
      wikilinks.push({
        dtag: match[1],
        display: match[2],
        original: match[0]
      });
    }
    
    // Extract hashtags from existing spans/links
    const hashtagRegex = /<(?:a|span)[^>]+class="hashtag"[^>]+data-topic="([^"]+)"[^>]*>#\1<\/\w+>/g;
    while ((match = hashtagRegex.exec(processed)) !== null) {
      const topic = match[1];
      if (!hashtags.includes(topic)) {
        hashtags.push(topic);
      }
    }
  }

  // Remove links inside code blocks (both <code> and <pre> tags)
  // This ensures URLs in code blocks remain as plain text
  const codeBlockLinkRegex = /(<(?:code|pre)[^>]*>)([\s\S]*?)(<\/(?:code|pre)>)/gi;
  processed = processed.replace(codeBlockLinkRegex, (match, openTag, content, closeTag) => {
    // Remove all <a> tags inside code blocks, keeping only the text content
    const cleanedContent = content.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1');
    return openTag + cleanedContent + closeTag;
  });

  // Process YouTube URLs - ORDER IS CRITICAL to avoid double-parsing
  // 1. FIRST: Fix video tags that contain YouTube URLs (before they get processed as bare URLs)
  // AsciiDoc's video:: macro creates <video> tags, but YouTube URLs should be iframes
  const youtubeVideoTagRegex = /<video[^>]+src="(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+))"[^>]*>[\s\S]*?<\/video>/gi;
  processed = processed.replace(youtubeVideoTagRegex, (match, url, videoId) => {
    const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
    return `<iframe class="youtube-embed" frameborder="0" allow="encrypted-media; fullscreen; picture-in-picture; web-share" referrerpolicy='strict-origin-when-cross-origin' width="100%" height="360" src="${escapeHtml(embedUrl)}"></iframe>`;
  });

  // 2. SECOND: Process YouTube links in <a> tags
  // IMPORTANT: Be very specific with YouTube regex to avoid matching Spotify URLs
  const youtubeLinkRegex = /<a[^>]+href="(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+))"[^>]*>.*?<\/a>/gi;
  processed = processed.replace(youtubeLinkRegex, (match, url, videoId) => {
    if (isInCodeBlock(processed.indexOf(match))) return match;
    const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
    return `<iframe class="youtube-embed" frameborder="0" allow="encrypted-media; fullscreen; picture-in-picture; web-share" referrerpolicy='strict-origin-when-cross-origin' width="100%" height="360" src="${escapeHtml(embedUrl)}"></iframe>`;
  });

  // 3. THIRD: Fix malformed YouTube iframes from AsciiDoc video:: macro
  // AsciiDoc sometimes creates iframes with malformed YouTube URLs (watch?v= or shorts/ instead of embed/)
  // Match the entire iframe element including closing tag to avoid duplicates
  const malformedYoutubeIframeRegex = /<iframe[^>]+src="[^"]*youtube[^"]*(?:watch\?v=|shorts\/)([a-zA-Z0-9_-]+)[^"]*"[^>]*(?:\/>|>[\s\S]*?<\/iframe>)/gi;
  processed = processed.replace(malformedYoutubeIframeRegex, (match, videoId) => {
    const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
    return `<iframe class="youtube-embed" frameborder="0" allow="encrypted-media; fullscreen; picture-in-picture; web-share" referrerpolicy='strict-origin-when-cross-origin' width="100%" height="360" src="${escapeHtml(embedUrl)}"></iframe>`;
  });
  
  // 3.5: Fix YouTube iframes with embed URLs but wrong parameters or missing required attributes
  // AsciiDoc's video:: macro creates iframes with ?rel=0 or missing allow/referrerpolicy attributes
  // Match iframes with embed URLs that don't have enablejsapi=1 or are missing required attributes
  const incompleteYoutubeIframeRegex = /<iframe[^>]+src="https?:\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)(\?[^"]*)?"[^>]*(?:\/>|>[\s\S]*?<\/iframe>)/gi;
  processed = processed.replace(incompleteYoutubeIframeRegex, (match, videoId, params) => {
    // Check if this iframe already has the correct format (has enablejsapi=1 and required attributes)
    if (match.includes('enablejsapi=1') && 
        match.includes('allow=') && 
        match.includes('referrerpolicy=') &&
        match.includes('class="youtube-embed"')) {
      return match; // Already correct, don't modify
    }
    // Fix the iframe with proper attributes
    const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
    return `<iframe class="youtube-embed" frameborder="0" allow="encrypted-media; fullscreen; picture-in-picture; web-share" referrerpolicy='strict-origin-when-cross-origin' width="100%" height="360" src="${escapeHtml(embedUrl)}"></iframe>`;
  });
  
  // 4. FOURTH: Fix any existing YouTube iframes that have malformed embed URLs (AsciiDoc sometimes creates broken embed URLs)
  // Match the entire iframe element including closing tag to avoid duplicates
  const brokenYoutubeIframeRegex = /<iframe[^>]+src="[^"]*youtube\.com\/embed\/[^"]*watch\?v=([a-zA-Z0-9_-]+)[^"]*"[^>]*(?:\/>|>[\s\S]*?<\/iframe>)/gi;
  processed = processed.replace(brokenYoutubeIframeRegex, (match, videoId) => {
    const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
    return `<iframe class="youtube-embed" frameborder="0" allow="encrypted-media; fullscreen; picture-in-picture; web-share" referrerpolicy='strict-origin-when-cross-origin' width="100%" height="360" src="${escapeHtml(embedUrl)}"></iframe>`;
  });

  // 5. LAST: Handle bare YouTube URLs (not in links, video tags, or iframes)
  // IMPORTANT: Match must be specific to youtube.com or youtu.be to avoid matching Spotify
  // This must come AFTER processing video tags and links to avoid double-parsing
  const bareYoutubeRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)(?:\?[^"\s<>]*)?)/gi;
  const youtubeReplacements: Array<{ match: string; replacement: string; index: number }> = [];
  while ((match = bareYoutubeRegex.exec(processed)) !== null) {
    if (isInCodeBlock(match.index)) continue;
    
    // Check if it's already in a tag (link, iframe, video, etc.)
    // Simple approach: check if we're inside quotes (attribute value) or between <tag and >
    const before = processed.substring(Math.max(0, match.index - 500), match.index);
    const after = processed.substring(match.index, match.index + match[0].length + 100);
    
    // Check if URL is inside quotes (attribute value like src="..." or href="...")
    const beforeContext = before.substring(Math.max(0, before.length - 100));
    if (beforeContext.match(/<(iframe|video|a|img|audio|source)[^>]*\s+(src|href)="[^"]*$/i)) {
      continue; // Inside an attribute value, skip
    }
    
    // Check if we're between an opening tag and its closing bracket
    const lastOpenTag = before.lastIndexOf('<');
    const lastCloseBracket = before.lastIndexOf('>');
    if (lastOpenTag > lastCloseBracket) {
      // We're inside a tag, check what kind
      const tagContent = before.substring(lastOpenTag);
      if (/<(iframe|video|a|img|audio|source)[^>]*$/i.test(tagContent)) {
        continue; // Skip URLs inside these tags
      }
    }
    
    const videoId = match[2];
    const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
    youtubeReplacements.push({
      match: match[0],
      replacement: `<iframe class="youtube-embed" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" width="100%" height="360" src="${escapeHtml(embedUrl)}"></iframe>`,
      index: match.index
    });
  }
  youtubeReplacements.reverse().forEach(({ match, replacement, index }) => {
    processed = processed.substring(0, index) + replacement + processed.substring(index + match.length);
  });
  
  // Fix double-closed iframes (safety net)
  processed = processed.replace(/<\/iframe><\/iframe>/gi, '</iframe>');

  // Spotify: https://open.spotify.com/episode/ID or https://open.spotify.com/track/ID or https://open.spotify.com/album/ID
  const spotifyLinkRegex = /<a[^>]+href="(https?:\/\/open\.spotify\.com\/(episode|track|album|playlist)\/([a-zA-Z0-9]+))[^"]*"[^>]*>.*?<\/a>/gi;
  processed = processed.replace(spotifyLinkRegex, (match, url, type, id) => {
    if (isInCodeBlock(processed.indexOf(match))) return match;
    const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
    return `<iframe src="${escapeHtml(embedUrl)}" width="100%" height="352" frameborder="0" allowtransparency="true" allow="encrypted-media" class="spotify-embed"></iframe>`;
  });

  // Also handle bare Spotify URLs (not in links)
  const bareSpotifyRegex = /(https?:\/\/open\.spotify\.com\/(episode|track|album|playlist)\/([a-zA-Z0-9]+)(?:\?[^"\s<>]*)?)/gi;
  const spotifyReplacements: Array<{ match: string; replacement: string; index: number }> = [];
  while ((match = bareSpotifyRegex.exec(processed)) !== null) {
    if (isInCodeBlock(match.index)) continue;
    // Check if it's already in a tag
    const before = processed.substring(0, match.index);
    const lastOpenTag = before.lastIndexOf('<');
    const lastCloseTag = before.lastIndexOf('>');
    if (lastOpenTag > lastCloseTag) continue; // Inside a tag
    
    const type = match[2];
    const id = match[3];
    const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
    spotifyReplacements.push({
      match: match[0],
      replacement: `<iframe src="${escapeHtml(embedUrl)}" width="100%" height="352" frameborder="0" allowtransparency="true" allow="encrypted-media" class="spotify-embed"></iframe>`,
      index: match.index
    });
  }
  spotifyReplacements.reverse().forEach(({ match, replacement, index }) => {
    processed = processed.substring(0, index) + replacement + processed.substring(index + match.length);
  });

  // Process bare image/media URLs that aren't already in tags
  // First, convert bare links (class="bare") that contain image/video/audio URLs to actual media elements
  // This handles cases where AsciiDoc has already converted URLs to links
  // IMPORTANT: Check YouTube FIRST, then Spotify, BEFORE checking file extensions to avoid conflicts
  const bareLinkRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*class="[^"]*bare[^"]*"[^>]*>([^<]*)<\/a>/gi;
  processed = processed.replace(bareLinkRegex, (match, url, linkText) => {
    if (isInCodeBlock(processed.indexOf(match))) return match;
    
    // Check YouTube URLs FIRST (be very specific - must be youtube.com or youtu.be)
    // This prevents accidentally matching Spotify URLs
    const youtubeMatch = url.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
      return `<iframe class="youtube-embed" frameborder="0" allow="encrypted-media; fullscreen; picture-in-picture; web-share" referrerpolicy='strict-origin-when-cross-origin' width="100%" height="360" src="${escapeHtml(embedUrl)}"></iframe>`;
    }
    
    // Check Spotify URLs (be very specific - must be open.spotify.com)
    const spotifyMatch = url.match(/https?:\/\/open\.spotify\.com\/(episode|track|album|playlist)\/([a-zA-Z0-9]+)/);
    if (spotifyMatch) {
      const type = spotifyMatch[1];
      const id = spotifyMatch[2];
      const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
      return `<iframe src="${escapeHtml(embedUrl)}" width="100%" height="352" frameborder="0" allowtransparency="true" allow="encrypted-media" class="spotify-embed"></iframe>`;
    }
    
    // Check if it's an image URL
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url)) {
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(linkText)}" class="bare-image" />`;
    }
    // Check if it's a video URL (but not YouTube)
    if (/\.(mp4|webm|ogg|mov|avi)(\?|$)/i.test(url)) {
      return `<video src="${escapeHtml(url)}" controls class="bare-video"></video>`;
    }
    // Check if it's an audio URL (but not Spotify)
    if (/\.(mp3|wav|ogg|flac|aac|m4a)(\?|$)/i.test(url)) {
      return `<audio src="${escapeHtml(url)}" controls class="bare-audio"></audio>`;
    }
    
    // Not a media URL, return as-is
    return match;
  });
  
  // Now process bare URLs that aren't in any tags at all
  // IMPORTANT: Skip YouTube and Spotify URLs - they're already processed above
  const imageUrlRegex = /(https?:\/\/[^\s<>"']+\.(jpg|jpeg|png|gif|webp|svg|bmp))(?![^<]*>)/gi;
  const videoUrlRegex = /(https?:\/\/[^\s<>"']+\.(mp4|webm|ogg|mov|avi))(?![^<]*>)/gi;
  const audioUrlRegex = /(https?:\/\/[^\s<>"']+\.(mp3|wav|ogg|flac|aac|m4a))(?![^<]*>)/gi;
  
  // Check if URL is already in a tag
  function isUrlInTag(url: string, index: number): boolean {
    const before = processed.substring(0, index);
    const after = processed.substring(index);
    
    // Check if it's inside an existing tag
    const lastOpenTag = before.lastIndexOf('<');
    const lastCloseTag = before.lastIndexOf('>');
    if (lastOpenTag > lastCloseTag) {
      const tagContent = processed.substring(lastOpenTag, index + url.length);
      if (/<(img|video|audio|a|source|iframe)[^>]*>/i.test(tagContent)) {
        return true;
      }
    }
    
    return false;
  }
  
  const mediaReplacements: Array<{ match: string; replacement: string; index: number }> = [];
  
  // Process images
  while ((match = imageUrlRegex.exec(processed)) !== null) {
    if (isInCodeBlock(match.index)) continue;
    if (isUrlInTag(match[0], match.index)) continue;
    
    const url = match[0];
    mediaReplacements.push({
      match: url,
      replacement: `<img src="${escapeHtml(url)}" alt="" class="bare-image" />`,
      index: match.index
    });
  }
  
  // Process videos (but skip YouTube URLs - they're handled above)
  while ((match = videoUrlRegex.exec(processed)) !== null) {
    if (isInCodeBlock(match.index)) continue;
    if (isUrlInTag(match[0], match.index)) continue;
    // Skip YouTube URLs - they should be embeds, not video tags
    if (/youtube\.com|youtu\.be/i.test(match[0])) continue;
    
    const url = match[0];
    mediaReplacements.push({
      match: url,
      replacement: `<video src="${escapeHtml(url)}" controls class="bare-video"></video>`,
      index: match.index
    });
  }
  
  // Process audio
  while ((match = audioUrlRegex.exec(processed)) !== null) {
    if (isInCodeBlock(match.index)) continue;
    if (isUrlInTag(match[0], match.index)) continue;
    
    const url = match[0];
    mediaReplacements.push({
      match: url,
      replacement: `<audio src="${escapeHtml(url)}" controls class="bare-audio"></audio>`,
      index: match.index
    });
  }
  
  // Apply media replacements in reverse order
  mediaReplacements.reverse().forEach(({ match, replacement, index }) => {
    processed = processed.substring(0, index) + replacement + processed.substring(index + match.length);
  });

  // Process markdown table alignment
  // Marked generates tables with align attributes or style attributes, we need to add CSS classes for styling
  // Match tables and process alignment on th/td elements
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  processed = processed.replace(tableRegex, (tableMatch: string, tableContent: string) => {
    // Process each row
    let processedTable = tableContent;
    
    // Find all th and td elements - check for align attribute or style with text-align
    const cellRegex = /<(th|td)([^>]*)>([\s\S]*?)<\/\1>/gi;
    processedTable = processedTable.replace(cellRegex, (cellMatch: string, tag: string, attrs: string, content: string) => {
      let align: string | null = null;
      let newAttrs = attrs;
      
      // Check for align attribute
      const alignMatch = attrs.match(/align=["'](left|center|right)["']/i);
      if (alignMatch) {
        align = alignMatch[1].toLowerCase();
        newAttrs = newAttrs.replace(/\s*align=["'](left|center|right)["']/i, '');
      } else {
        // Check for style attribute with text-align
        const styleMatch = attrs.match(/style=["']([^"']*text-align:\s*(left|center|right)[^"']*)["']/i);
        if (styleMatch) {
          align = styleMatch[2].toLowerCase();
          // Remove text-align from style
          const styleContent = styleMatch[1].replace(/text-align:\s*(left|center|right);?/gi, '').trim();
          if (styleContent) {
            newAttrs = newAttrs.replace(/style=["'][^"']+["']/, `style="${styleContent}"`);
          } else {
            newAttrs = newAttrs.replace(/\s*style=["'][^"']+["']/, '');
          }
        }
      }
      
      // If we found alignment, add CSS class
      if (align) {
        const alignClass = align === 'left' ? 'halign-left' : 
                          align === 'center' ? 'halign-center' : 'halign-right';
        
        // If there's already a class attribute, merge them
        if (newAttrs.includes('class=')) {
          const classMatch = newAttrs.match(/class=["']([^"']+)["']/);
          if (classMatch) {
            const existingClass = classMatch[1];
            if (!existingClass.includes(alignClass)) {
              newAttrs = newAttrs.replace(/class=["'][^"']+["']/, `class="${existingClass} ${alignClass}"`);
            }
          }
        } else {
          newAttrs = `${newAttrs} class="${alignClass}"`.trim();
        }
      }
      
      return `<${tag}${newAttrs}>${content}</${tag}>`;
    });
    
    return `<table>${processedTable}</table>`;
  });

  return {
    html: processed,
    nostrLinks,
    wikilinks,
    hashtags
  };
}

/**
 * Get Nostr identifier type from bech32 string
 */
function getNostrType(bech32: string): 'npub' | 'nprofile' | 'nevent' | 'naddr' | 'note' | null {
  if (bech32.startsWith('npub')) return 'npub';
  if (bech32.startsWith('nprofile')) return 'nprofile';
  if (bech32.startsWith('nevent')) return 'nevent';
  if (bech32.startsWith('naddr')) return 'naddr';
  if (bech32.startsWith('note')) return 'note';
  return null;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
