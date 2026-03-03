/**
 * Normalizes a d tag according to NIP-54 rules
 */
export function normalizeDTag(dTag: string): string {
  // Convert to lowercase
  let normalized = dTag.toLowerCase();

  // Convert whitespace to hyphens
  normalized = normalized.replace(/\s+/g, '-');

  // Remove punctuation and symbols (keep alphanumeric, hyphens, and non-ASCII)
  normalized = normalized.replace(/[^a-z0-9\-\u0080-\uFFFF]/g, '');

  // Collapse multiple consecutive hyphens
  normalized = normalized.replace(/-+/g, '-');

  // Remove leading and trailing hyphens
  normalized = normalized.replace(/^-+|-+$/g, '');

  return normalized;
}

/**
 * Rewrites wikilinks and nostr: links in AsciiDoc content
 */
export function rewriteAsciiDocLinks(content: string, linkBaseURL: string): string {
  // Rewrite wikilinks: [[target]] or [[target|display text]]
  // Format: [[target]] -> link:url[display]
  const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
  content = content.replace(wikilinkRegex, (match, inner) => {
    let target: string;
    let display: string;

    if (inner.includes('|')) {
      const parts = inner.split('|', 2);
      target = parts[0].trim();
      display = parts[1].trim();
    } else {
      target = inner.trim();
      display = target;
    }

    // Normalize the d tag
    const normalized = normalizeDTag(target);

    // Create the link
    if (linkBaseURL) {
      const url = `${linkBaseURL}/events?d=${normalized}`;
      return `link:${url}[${display}]`;
    }
    return `link:#${normalized}[${display}]`;
  });

  // Rewrite nostr: links: nostr:naddr1... or nostr:nevent1...
  // Format: nostr:naddr1... -> link:url[nostr:naddr1...]
  const nostrLinkRegex = /nostr:(naddr1[^\s\]]+|nevent1[^\s\]]+)/g;
  content = content.replace(nostrLinkRegex, (match, nostrID) => {
    if (linkBaseURL) {
      const url = `${linkBaseURL}/events?id=${nostrID}`;
      return `link:${url}[${match}]`;
    }
    return match;
  });

  return content;
}
