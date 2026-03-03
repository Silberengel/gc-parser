import { normalizeDTag } from './asciidoc-links';

/**
 * Rewrites wikilinks and nostr: links in Markdown content
 */
export function rewriteMarkdownLinks(content: string, linkBaseURL: string): string {
  // Rewrite wikilinks: [[target]] or [[target|display text]]
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

    const normalized = normalizeDTag(target);

    if (linkBaseURL) {
      const url = `${linkBaseURL}/events?d=${normalized}`;
      return `[${display}](${url})`;
    }
    return `[${display}](#${normalized})`;
  });

  // Rewrite nostr: links in Markdown
  const nostrLinkRegex = /nostr:(naddr1[^\s\]]+|nevent1[^\s\]]+|note1[^\s\]]+|npub1[^\s\]]+|nprofile1[^\s\]]+)/g;
  content = content.replace(nostrLinkRegex, (match, nostrID) => {
    if (linkBaseURL) {
      let url: string;
      if (nostrID.startsWith('npub')) {
        url = `${linkBaseURL}/profile?pubkey=${nostrID}`;
      } else if (nostrID.startsWith('nprofile')) {
        url = `${linkBaseURL}/profile?id=${nostrID}`;
      } else {
        url = `${linkBaseURL}/events?id=${nostrID}`;
      }
      return `[${match}](${url})`;
    }
    return match;
  });

  return content;
}
