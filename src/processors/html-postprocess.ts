import { processMusicalNotation } from './music';

export interface PostProcessOptions {
  enableMusicalNotation?: boolean;
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
    return `<a href="/notes?t=${normalizedHashtag}" class="hashtag-link text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline">${displayText}</a>`;
  });

  // Convert wikilink:dtag[display] format to HTML
  processed = processed.replace(/wikilink:([^[]+)\[([^\]]+)\]/g, (_match, dTag, displayText) => {
    const escapedDtag = dTag.replace(/"/g, '&quot;');
    const escapedDisplay = displayText.replace(/"/g, '&quot;');
    return `<span class="wikilink cursor-pointer text-blue-600 hover:text-blue-800 hover:underline border-b border-dotted border-blue-300" data-dtag="${escapedDtag}" data-display="${escapedDisplay}">${displayText}</span>`;
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
      updatedAttributes = updatedAttributes.replace(/class=["']([^"']*)["']/i, (_match, classes) => {
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
 * Clean up leftover markdown syntax
 */
function cleanupMarkdown(html: string): string {
  let cleaned = html;

  // Clean up markdown image syntax
  cleaned = cleaned.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const altText = alt || '';
    return `<img src="${url}" alt="${altText}" class="max-w-[400px] object-contain my-0" />`;
  });

  // Clean up markdown link syntax
  cleaned = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
    if (cleaned.includes(`href="${url}"`)) {
      return _match;
    }
    return `<a href="${url}" target="_blank" rel="noreferrer noopener" class="break-words inline-flex items-baseline gap-1">${text} <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>`;
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
