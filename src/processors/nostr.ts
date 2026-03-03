/**
 * Processes nostr: prefixed addresses
 */
export function processNostrAddresses(content: string, linkBaseURL: string): string {
  // Pattern: nostr:naddr1..., nostr:nevent1..., nostr:note1..., nostr:npub1..., nostr:nprofile1...
  const nostrPattern = /nostr:([a-z0-9]+[a-z0-9]{1,})/g;

  return content.replace(nostrPattern, (match, nostrID) => {
    // If linkBaseURL is set, convert to a link
    if (linkBaseURL) {
      // Determine the type and create appropriate link
      if (nostrID.startsWith('naddr')) {
        return `<a href="${linkBaseURL}/events?id=${nostrID}" class="nostr-address">${match}</a>`;
      } else if (nostrID.startsWith('nevent')) {
        return `<a href="${linkBaseURL}/events?id=${nostrID}" class="nostr-address">${match}</a>`;
      } else if (nostrID.startsWith('note')) {
        return `<a href="${linkBaseURL}/events?id=${nostrID}" class="nostr-address">${match}</a>`;
      } else if (nostrID.startsWith('npub')) {
        return `<a href="${linkBaseURL}/profile?pubkey=${nostrID}" class="nostr-address">${match}</a>`;
      } else if (nostrID.startsWith('nprofile')) {
        return `<a href="${linkBaseURL}/profile?id=${nostrID}" class="nostr-address">${match}</a>`;
      }
    }

    // Return as a span with class for styling
    return `<span class="nostr-address">${match}</span>`;
  });
}
