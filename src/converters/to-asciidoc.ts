import { ContentFormat } from '../types';

export interface ConvertOptions {
  enableNostrAddresses?: boolean;
}

/**
 * Converts content from various formats (Markdown, Wikipedia, Plain) to AsciiDoc
 * 
 * Processing order:
 * 1. Convert special syntax (wikilinks, hashtags, nostr links) to placeholders
 * 2. Process media URLs (YouTube, Spotify, video, audio)
 * 3. Process images (Markdown and bare URLs)
 * 4. Process links (Markdown and bare URLs)
 * 5. Clean URLs (remove tracking parameters)
 */
export function convertToAsciidoc(
  content: string,
  format: ContentFormat,
  linkBaseURL?: string,
  options: ConvertOptions = {}
): string {
  let processed = content;

  // Step 1: Convert special syntax to placeholders (before other processing)
  processed = convertWikilinks(processed);
  processed = convertHashtags(processed);
  
  if (options.enableNostrAddresses !== false) {
    processed = convertNostrLinks(processed);
  }

  // Step 2: Process media URLs (before link processing to avoid conflicts)
  processed = processMediaUrls(processed);

  // Step 3: Process images (before links to avoid conflicts)
  processed = processImages(processed, format);

  // Step 4: Process links (Markdown and bare URLs)
  processed = processLinks(processed, format);

  // Step 5: Convert format-specific syntax
  if (format === ContentFormat.Markdown) {
    processed = convertMarkdownToAsciidoc(processed);
  } else if (format === ContentFormat.Wikipedia) {
    processed = convertWikipediaToAsciidoc(processed);
  }

  return processed;
}

/**
 * Convert wikilinks [[target]] or [[target|display]] to WIKILINK:dtag|display
 */
function convertWikilinks(content: string): string {
  return content.replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_match, target, display) => {
    const dtag = normalizeDtag(target.trim());
    const displayText = display ? display.trim() : target.trim();
    return `WIKILINK:${dtag}|${displayText}`;
  });
}

/**
 * Normalize dtag (lowercase, replace spaces with hyphens)
 */
function normalizeDtag(dtag: string): string {
  return dtag.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Convert hashtags #topic to hashtag:topic[topic]
 * Skip hashtags in URLs, code blocks, and inline code
 */
function convertHashtags(content: string): string {
  // Protect code blocks
  const codeBlocks: string[] = [];
  content = content.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `__CODEBLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // Protect inline code
  const inlineCode: string[] = [];
  content = content.replace(/`[^`]+`/g, (match) => {
    const placeholder = `__INLINECODE_${inlineCode.length}__`;
    inlineCode.push(match);
    return placeholder;
  });

  // Convert hashtags (not in URLs)
  content = content.replace(/(?<!https?:\/\/[^\s]*)#([a-zA-Z0-9_]+)/g, (_match, topic) => {
    const normalized = topic.toLowerCase();
    return `hashtag:${normalized}[#${topic}]`;
  });

  // Restore inline code
  inlineCode.forEach((code, index) => {
    content = content.replace(`__INLINECODE_${index}__`, code);
  });

  // Restore code blocks
  codeBlocks.forEach((block, index) => {
    content = content.replace(`__CODEBLOCK_${index}__`, block);
  });

  return content;
}

/**
 * Convert nostr: links to link:nostr:...[...]
 */
function convertNostrLinks(content: string): string {
  // Match nostr:npub1..., nostr:note1..., etc.
  return content.replace(/nostr:([a-z0-9]+[a-z0-9]{50,})/gi, (match, bech32Id) => {
    // Extract display text (first few chars)
    const display = bech32Id.substring(0, 8) + '...';
    return `link:nostr:${bech32Id}[${display}]`;
  });
}

/**
 * Process media URLs and convert to MEDIA: placeholders
 */
function processMediaUrls(content: string): string {
  let processed = content;

  // YouTube URLs
  processed = processed.replace(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/g,
    (_match, videoId) => `MEDIA:youtube:${videoId}`
  );

  // Spotify URLs
  processed = processed.replace(
    /(?:https?:\/\/)?(?:open\.)?spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/g,
    (_match, type, id) => `MEDIA:spotify:${type}:${id}`
  );

  // Video files
  processed = processed.replace(
    /(https?:\/\/[^\s<>"{}|\\^`\[\]()]+\.(mp4|webm|ogg|m4v|mov|avi|mkv|flv|wmv))/gi,
    (_match, url) => `MEDIA:video:${url}`
  );

  // Audio files
  processed = processed.replace(
    /(https?:\/\/[^\s<>"{}|\\^`\[\]()]+\.(mp3|m4a|wav|flac|aac|opus|wma|ogg))/gi,
    (_match, url) => `MEDIA:audio:${url}`
  );

  return processed;
}

/**
 * Process images (Markdown syntax and bare URLs)
 */
function processImages(content: string, format: ContentFormat): string {
  let processed = content;

  // Markdown image syntax: ![alt](url)
  processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const cleanedUrl = cleanUrl(url);
    const cleanAlt = alt.trim();
    return `image::${cleanedUrl}[${cleanAlt ? cleanAlt + ',' : ''}width=100%]`;
  });

  // Bare image URLs (only if not already in a link or image tag)
  if (format === ContentFormat.Markdown || format === ContentFormat.Plain) {
    const imageUrlPattern = /(?<!\]\()(?<!image::)(?<!link:)(https?:\/\/[^\s<>"{}|\\^`\[\]()]+\.(jpeg|jpg|png|gif|webp|svg))/gi;
    processed = processed.replace(imageUrlPattern, (match, url) => {
      const cleanedUrl = cleanUrl(url);
      return `image::${cleanedUrl}[width=100%]`;
    });
  }

  return processed;
}

/**
 * Process links (Markdown syntax and bare URLs)
 */
function processLinks(content: string, format: ContentFormat): string {
  let processed = content;

  // Markdown link syntax: [text](url)
  processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
    // Skip if this is already processed as an image
    if (text.startsWith('!')) {
      return _match;
    }
    const cleanedUrl = cleanUrl(url);
    return `link:${cleanedUrl}[${text}]`;
  });

  // Bare URLs (only for Markdown and Plain formats)
  if (format === ContentFormat.Markdown || format === ContentFormat.Plain) {
    processed = processBareUrls(processed);
  }

  return processed;
}

/**
 * Process bare URLs and convert to link: macros
 * Handles http://, https://, www., and wss:// URLs
 */
function processBareUrls(content: string): string {
  // URL pattern: matches http://, https://, www., and wss://
  // Negative lookbehind to avoid matching URLs after ":" (e.g., "hyperlink: www.example.com")
  const urlPattern = /(?<!:\s)(?<!\]\()\b(https?:\/\/[^\s<>"{}|\\^`\[\]()]+|wss:\/\/[^\s<>"{}|\\^`\[\]()]+|www\.[^\s<>"{}|\\^`\[\]()]+)/gi;

  return content.replace(urlPattern, (match, url) => {
    // Skip if already in a link or image macro
    if (match.includes('link:') || match.includes('image::')) {
      return match;
    }

    let fullUrl = url;
    let displayText = url;

    // Handle www. URLs
    if (url.startsWith('www.')) {
      fullUrl = 'https://' + url;
      displayText = url;
    }
    // Handle wss:// URLs - convert to https:// for the link, but keep wss:// in display
    else if (url.startsWith('wss://')) {
      fullUrl = url.replace(/^wss:\/\//, 'https://');
      displayText = url; // Keep wss:// in display text
    }

    // Clean the URL (remove tracking parameters)
    fullUrl = cleanUrl(fullUrl);

    // Create AsciiDoc link macro
    return `link:${fullUrl}[${displayText}]`;
  });
}

/**
 * Clean URL by removing tracking parameters
 */
function cleanUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    
    // List of tracking parameters to remove
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
 * Convert Markdown-specific syntax to AsciiDoc
 */
function convertMarkdownToAsciidoc(content: string): string {
  // Most Markdown syntax is handled by AsciiDoctor's markdown support
  // This function can be extended for additional conversions if needed
  return content;
}

/**
 * Convert Wikipedia-specific syntax to AsciiDoc
 */
function convertWikipediaToAsciidoc(content: string): string {
  // Wikipedia-specific conversions can be added here
  return content;
}
