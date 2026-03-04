/**
 * HTML utility functions for processing AsciiDoctor output
 * 
 * Functions:
 * - extractTOC: Extract table of contents from HTML
 * - sanitizeHTML: Sanitize HTML to prevent XSS attacks
 * - processLinks: Add target="_blank" to external links
 */

export interface TOCResult {
  toc: string;
  contentWithoutTOC: string;
}

/**
 * Extract table of contents from AsciiDoctor HTML output
 * AsciiDoctor generates a <div id="toc"> with class="toc" containing the TOC
 */
export function extractTOC(html: string): TOCResult {
  // Match the TOC div - AsciiDoctor generates it with id="toc" and class="toc"
  const tocMatch = html.match(/<div[^>]*id=["']toc["'][^>]*>([\s\S]*?)<\/div>/i);
  
  if (tocMatch) {
    const toc = tocMatch[0]; // Full TOC div
    const contentWithoutTOC = html.replace(toc, '').trim();
    return { toc, contentWithoutTOC };
  }
  
  // Fallback: try to match by class="toc"
  const tocClassMatch = html.match(/<div[^>]*class=["'][^"']*toc[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  
  if (tocClassMatch) {
    const toc = tocClassMatch[0];
    const contentWithoutTOC = html.replace(toc, '').trim();
    return { toc, contentWithoutTOC };
  }
  
  // No TOC found
  return {
    toc: '',
    contentWithoutTOC: html,
  };
}

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes dangerous scripts and event handlers while preserving safe HTML
 * 
 * This is a basic sanitizer. For production use, consider using a library like DOMPurify
 */
export function sanitizeHTML(html: string): string {
  let sanitized = html;
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '');
  
  // Remove event handlers from attributes (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol in href and src attributes
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
  
  // Remove data: URLs that might contain scripts (allow images)
  // This is more permissive - you might want to be stricter
  sanitized = sanitized.replace(/src\s*=\s*["']data:text\/html[^"']*["']/gi, 'src=""');
  
  // Remove iframe with dangerous sources
  sanitized = sanitized.replace(/<iframe[^>]*src\s*=\s*["']javascript:[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi, '');
  
  // Remove object and embed tags (often used for XSS)
  sanitized = sanitized.replace(/<object[\s\S]*?<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed[\s\S]*?>/gi, '');
  
  // Remove style tags with potentially dangerous content
  // We keep style attributes but remove <style> tags
  sanitized = sanitized.replace(/<style[\s\S]*?<\/style>/gi, '');
  
  // Remove link tags with javascript: or data: URLs
  sanitized = sanitized.replace(/<link[^>]*href\s*=\s*["'](javascript|data):[^"']*["'][^>]*>/gi, '');
  
  // Remove meta tags with http-equiv="refresh" (can be used for redirects)
  sanitized = sanitized.replace(/<meta[^>]*http-equiv\s*=\s*["']refresh["'][^>]*>/gi, '');
  
  return sanitized;
}

/**
 * Process links to add target="_blank" and rel="noreferrer noopener" to external links
 * 
 * External links are links that don't match the base domain.
 * Internal links (same domain) are left unchanged.
 */
export function processLinks(html: string, linkBaseURL: string): string {
  if (!linkBaseURL) {
    return html;
  }
  
  // Extract base domain from linkBaseURL
  let baseDomain: string | null = null;
  try {
    const urlMatch = linkBaseURL.match(/^https?:\/\/([^\/]+)/);
    if (urlMatch) {
      baseDomain = urlMatch[1];
    }
  } catch {
    // If parsing fails, don't process links
    return html;
  }
  
  if (!baseDomain) {
    return html;
  }
  
  // Process anchor tags with href attributes
  return html.replace(/<a\s+([^>]*\s+)?href\s*=\s*["']([^"']+)["']([^>]*?)>/gi, (match, before, href, after) => {
    // Skip if already has target attribute
    if (match.includes('target=')) {
      return match;
    }
    
    // Skip if it's not an http/https link
    if (!/^https?:\/\//i.test(href)) {
      return match;
    }
    
    // Skip if it's already a special link type (nostr, wikilink, etc.)
    if (match.includes('class="nostr-link"') ||
        match.includes('class="wikilink"') ||
        match.includes('class="hashtag-link"')) {
      return match;
    }
    
    // Check if it's an external link
    let isExternal = true;
    try {
      const hrefMatch = href.match(/^https?:\/\/([^\/]+)/);
      if (hrefMatch && hrefMatch[1] === baseDomain) {
        isExternal = false;
      }
    } catch {
      // If parsing fails, assume external
    }
    
    // Only add target="_blank" to external links
    if (isExternal) {
      // Check if there's already a rel attribute
      if (match.includes('rel=')) {
        // Add to existing rel attribute if it doesn't already have noreferrer noopener
        if (!match.includes('noreferrer') && !match.includes('noopener')) {
          return match.replace(/rel\s*=\s*["']([^"']+)["']/i, 'rel="$1 noreferrer noopener"');
        }
        // Add target="_blank" before the closing >
        return match.replace(/>$/, ' target="_blank">');
      } else {
        // Add both target and rel
        return match.replace(/>$/, ' target="_blank" rel="noreferrer noopener">');
      }
    }
    
    return match;
  });
}
