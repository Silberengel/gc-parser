import { Parser } from '../parser';
import * as fs from 'fs';
import * as path from 'path';
import { ProcessResult } from '../types';

/**
 * Shared utilities for generating test reports
 */

export interface TestData {
  original: string;
  result: ProcessResult;
}

export interface ReportData {
  markdown: TestData;
  asciidoc: TestData;
}

/**
 * Generate HTML test report from parsed documents
 */
export function generateHTMLReport(data: ReportData): string {
  const { markdown, asciidoc } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GC Parser Test Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    h1 {
      color: #2c3e50;
      margin-bottom: 10px;
      font-size: 2.5em;
    }
    
    .subtitle {
      color: #7f8c8d;
      margin-bottom: 30px;
      font-size: 1.1em;
    }
    
    .section {
      background: white;
      border-radius: 8px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .section h2 {
      color: #34495e;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #3498db;
      font-size: 1.8em;
    }
    
    .section h3 {
      color: #2c3e50;
      margin-top: 25px;
      margin-bottom: 15px;
      font-size: 1.3em;
    }
    
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    }
    
    .tab {
      padding: 12px 24px;
      background: #f8f9fa;
      border: none;
      border-top-left-radius: 6px;
      border-top-right-radius: 6px;
      cursor: pointer;
      font-size: 1em;
      font-weight: 500;
      color: #555;
      transition: all 0.2s;
    }
    
    .tab:hover {
      background: #e9ecef;
    }
    
    .tab.active {
      background: #3498db;
      color: white;
    }
    
    .tab-content {
      display: none;
    }
    
    .tab-content.active {
      display: block;
    }
    
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    
    .metadata-item {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 4px;
      border-left: 3px solid #3498db;
    }
    
    .metadata-item strong {
      color: #2c3e50;
      display: block;
      margin-bottom: 5px;
    }
    
    .metadata-item code {
      background: #e9ecef;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    
    .code-block {
      background: #2d2d2d;
      color: #f8f8f2;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      line-height: 1.5;
      margin: 15px 0;
      max-height: 400px;
      overflow-y: auto;
    }
    
    .code-block pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    .rendered-output {
      background: white;
      border: 1px solid #ddd;
      padding: 20px;
      border-radius: 6px;
      margin: 15px 0;
      min-height: 200px;
    }
    
    .rendered-output * {
      max-width: 100%;
    }
    
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    
    .stat-card .number {
      font-size: 2.5em;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .stat-card .label {
      font-size: 0.9em;
      opacity: 0.9;
    }
    
    .list-item {
      background: #f8f9fa;
      padding: 8px 12px;
      margin: 5px 0;
      border-radius: 4px;
      border-left: 3px solid #95a5a6;
    }
    
    .list-item code {
      background: #e9ecef;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.85em;
    }
    
    .success-badge {
      display: inline-block;
      background: #27ae60;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 500;
      margin-left: 10px;
    }
    
    .warning-badge {
      display: inline-block;
      background: #f39c12;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 500;
      margin-left: 10px;
    }
    
    .comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    
    @media (max-width: 768px) {
      .comparison {
        grid-template-columns: 1fr;
      }
    }
    
    .json-view {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 0.85em;
      max-height: 300px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>GC Parser Test Report</h1>
    <p class="subtitle">Generated: ${new Date().toLocaleString()}</p>
    
    <!-- Markdown Section -->
    <div class="section">
      <h2>Markdown Document Test <span class="success-badge">✓ Parsed</span></h2>
      
      <div class="tabs">
        <button class="tab active" onclick="showTab('md-overview')">Overview</button>
        <button class="tab" onclick="showTab('md-original')">Original Content</button>
        <button class="tab" onclick="showTab('md-rendered')">Rendered Output</button>
        <button class="tab" onclick="showTab('md-metadata')">Metadata</button>
      </div>
      
      <div id="md-overview" class="tab-content active">
        <div class="stats">
          <div class="stat-card">
            <div class="number">${markdown.result.nostrLinks.length}</div>
            <div class="label">Nostr Links</div>
          </div>
          <div class="stat-card">
            <div class="number">${markdown.result.wikilinks.length}</div>
            <div class="label">Wikilinks</div>
          </div>
          <div class="stat-card">
            <div class="number">${markdown.result.hashtags.length}</div>
            <div class="label">Hashtags</div>
          </div>
          <div class="stat-card">
            <div class="number">${markdown.result.links.length}</div>
            <div class="label">Links</div>
          </div>
          <div class="stat-card">
            <div class="number">${markdown.result.media.length}</div>
            <div class="label">Media URLs</div>
          </div>
          <div class="stat-card">
            <div class="number">${markdown.result.hasLaTeX ? 'Yes' : 'No'}</div>
            <div class="label">Has LaTeX</div>
          </div>
          <div class="stat-card">
            <div class="number">${markdown.result.hasMusicalNotation ? 'Yes' : 'No'}</div>
            <div class="label">Has Music</div>
          </div>
        </div>
        
        <h3>Frontmatter</h3>
        ${markdown.result.frontmatter ? `
          <div class="metadata-grid">
            ${Object.entries(markdown.result.frontmatter).map(([key, value]) => `
              <div class="metadata-item">
                <strong>${escapeHtml(key)}</strong>
                <code>${escapeHtml(JSON.stringify(value))}</code>
              </div>
            `).join('')}
          </div>
        ` : '<p><em>No frontmatter found</em></p>'}
      </div>
      
      <div id="md-original" class="tab-content">
        <h3>Original Markdown Content</h3>
        <div class="code-block">
          <pre>${escapeHtml(markdown.original)}</pre>
        </div>
      </div>
      
      <div id="md-rendered" class="tab-content">
        <h3>Rendered HTML Output</h3>
        <div class="rendered-output">
          ${cleanHtmlContent(markdown.result.content)}
        </div>
        <details style="margin-top: 15px;">
          <summary style="cursor: pointer; color: #3498db; font-weight: 500;">View Raw HTML</summary>
          <div class="code-block" style="margin-top: 10px;">
            <pre>${escapeHtml(markdown.result.content)}</pre>
          </div>
        </details>
      </div>
      
      <div id="md-metadata" class="tab-content">
        <h3>Extracted Metadata</h3>
        
        ${markdown.result.nostrLinks.length > 0 ? `
          <h4>Nostr Links (${markdown.result.nostrLinks.length})</h4>
          ${markdown.result.nostrLinks.map((link: any) => `
            <div class="list-item">
              <strong>${escapeHtml(link.type)}</strong>: <code>${escapeHtml(link.bech32)}</code>
              ${link.text ? ` - ${escapeHtml(link.text)}` : ''}
            </div>
          `).join('')}
        ` : ''}
        
        ${markdown.result.wikilinks.length > 0 ? `
          <h4>Wikilinks (${markdown.result.wikilinks.length})</h4>
          ${markdown.result.wikilinks.map((wl: any) => `
            <div class="list-item">
              <code>${escapeHtml(wl.original)}</code> → dtag: <code>${escapeHtml(wl.dtag)}</code>
              ${wl.display ? ` (display: ${escapeHtml(wl.display)})` : ''}
            </div>
          `).join('')}
        ` : ''}
        
        ${markdown.result.hashtags.length > 0 ? `
          <h4>Hashtags (${markdown.result.hashtags.length})</h4>
          ${markdown.result.hashtags.map((tag: string) => `
            <div class="list-item">
              <code>#${escapeHtml(tag)}</code>
            </div>
          `).join('')}
        ` : ''}
        
        ${markdown.result.links.length > 0 ? `
          <h4>Links (${markdown.result.links.length})</h4>
          ${markdown.result.links.map((link: any) => `
            <div class="list-item">
              <a href="${escapeHtml(link.url)}" target="_blank">${escapeHtml(link.text || link.url)}</a>
              ${link.isExternal ? '<span class="warning-badge">External</span>' : ''}
            </div>
          `).join('')}
        ` : ''}
        
        ${markdown.result.media.length > 0 ? `
          <h4>Media URLs (${markdown.result.media.length})</h4>
          ${markdown.result.media.map((url: string) => `
            <div class="list-item">
              <a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url)}</a>
            </div>
          `).join('')}
        ` : ''}
        
        ${markdown.result.tableOfContents ? `
          <h4>Table of Contents</h4>
          <div class="rendered-output">
            ${markdown.result.tableOfContents}
          </div>
        ` : ''}
      </div>
    </div>
    
    <!-- AsciiDoc Section -->
    <div class="section">
      <h2>AsciiDoc Document Test <span class="success-badge">✓ Parsed</span></h2>
      
      <div class="tabs">
        <button class="tab active" onclick="showTab('ad-overview')">Overview</button>
        <button class="tab" onclick="showTab('ad-original')">Original Content</button>
        <button class="tab" onclick="showTab('ad-rendered')">Rendered Output</button>
        <button class="tab" onclick="showTab('ad-metadata')">Metadata</button>
      </div>
      
      <div id="ad-overview" class="tab-content active">
        <div class="stats">
          <div class="stat-card">
            <div class="number">${asciidoc.result.nostrLinks.length}</div>
            <div class="label">Nostr Links</div>
          </div>
          <div class="stat-card">
            <div class="number">${asciidoc.result.wikilinks.length}</div>
            <div class="label">Wikilinks</div>
          </div>
          <div class="stat-card">
            <div class="number">${asciidoc.result.hashtags.length}</div>
            <div class="label">Hashtags</div>
          </div>
          <div class="stat-card">
            <div class="number">${asciidoc.result.links.length}</div>
            <div class="label">Links</div>
          </div>
          <div class="stat-card">
            <div class="number">${asciidoc.result.media.length}</div>
            <div class="label">Media URLs</div>
          </div>
          <div class="stat-card">
            <div class="number">${asciidoc.result.hasLaTeX ? 'Yes' : 'No'}</div>
            <div class="label">Has LaTeX</div>
          </div>
          <div class="stat-card">
            <div class="number">${asciidoc.result.hasMusicalNotation ? 'Yes' : 'No'}</div>
            <div class="label">Has Music</div>
          </div>
        </div>
        
        <h3>Frontmatter</h3>
        ${asciidoc.result.frontmatter ? `
          <div class="metadata-grid">
            ${Object.entries(asciidoc.result.frontmatter).map(([key, value]) => `
              <div class="metadata-item">
                <strong>${escapeHtml(key)}</strong>
                <code>${escapeHtml(JSON.stringify(value))}</code>
              </div>
            `).join('')}
          </div>
        ` : '<p><em>No frontmatter found</em></p>'}
      </div>
      
      <div id="ad-original" class="tab-content">
        <h3>Original AsciiDoc Content</h3>
        <div class="code-block">
          <pre>${escapeHtml(asciidoc.original)}</pre>
        </div>
      </div>
      
      <div id="ad-rendered" class="tab-content">
        <h3>Rendered HTML Output</h3>
        <div class="rendered-output">
          ${cleanHtmlContent(asciidoc.result.content)}
        </div>
        <details style="margin-top: 15px;">
          <summary style="cursor: pointer; color: #3498db; font-weight: 500;">View Raw HTML</summary>
          <div class="code-block" style="margin-top: 10px;">
            <pre>${escapeHtml(asciidoc.result.content)}</pre>
          </div>
        </details>
      </div>
      
      <div id="ad-metadata" class="tab-content">
        <h3>Extracted Metadata</h3>
        
        ${asciidoc.result.nostrLinks.length > 0 ? `
          <h4>Nostr Links (${asciidoc.result.nostrLinks.length})</h4>
          ${asciidoc.result.nostrLinks.map((link: any) => `
            <div class="list-item">
              <strong>${escapeHtml(link.type)}</strong>: <code>${escapeHtml(link.bech32)}</code>
              ${link.text ? ` - ${escapeHtml(link.text)}` : ''}
            </div>
          `).join('')}
        ` : ''}
        
        ${asciidoc.result.wikilinks.length > 0 ? `
          <h4>Wikilinks (${asciidoc.result.wikilinks.length})</h4>
          ${asciidoc.result.wikilinks.map((wl: any) => `
            <div class="list-item">
              <code>${escapeHtml(wl.original)}</code> → dtag: <code>${escapeHtml(wl.dtag)}</code>
              ${wl.display ? ` (display: ${escapeHtml(wl.display)})` : ''}
            </div>
          `).join('')}
        ` : ''}
        
        ${asciidoc.result.hashtags.length > 0 ? `
          <h4>Hashtags (${asciidoc.result.hashtags.length})</h4>
          ${asciidoc.result.hashtags.map((tag: string) => `
            <div class="list-item">
              <code>#${escapeHtml(tag)}</code>
            </div>
          `).join('')}
        ` : ''}
        
        ${asciidoc.result.links.length > 0 ? `
          <h4>Links (${asciidoc.result.links.length})</h4>
          ${asciidoc.result.links.map((link: any) => `
            <div class="list-item">
              <a href="${escapeHtml(link.url)}" target="_blank">${escapeHtml(link.text || link.url)}</a>
              ${link.isExternal ? '<span class="warning-badge">External</span>' : ''}
            </div>
          `).join('')}
        ` : ''}
        
        ${asciidoc.result.media.length > 0 ? `
          <h4>Media URLs (${asciidoc.result.media.length})</h4>
          ${asciidoc.result.media.map((url: string) => `
            <div class="list-item">
              <a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url)}</a>
            </div>
          `).join('')}
        ` : ''}
        
        ${asciidoc.result.tableOfContents ? `
          <h4>Table of Contents</h4>
          <div class="rendered-output">
            ${asciidoc.result.tableOfContents}
          </div>
        ` : ''}
      </div>
    </div>
  </div>
  
  <script>
    function showTab(tabId) {
      // Hide all tab contents
      const allContents = document.querySelectorAll('.tab-content');
      allContents.forEach(content => content.classList.remove('active'));
      
      // Remove active class from all tabs
      const allTabs = document.querySelectorAll('.tab');
      allTabs.forEach(tab => tab.classList.remove('active'));
      
      // Show selected tab content
      const selectedContent = document.getElementById(tabId);
      if (selectedContent) {
        selectedContent.classList.add('active');
      }
      
      // Add active class to clicked tab
      event.target.classList.add('active');
    }
  </script>
</body>
</html>`;
}

/**
 * Clean HTML content to extract only the body content
 * Removes full HTML document structure if present
 * Prevents infinite loops by ensuring we only extract once and handle nested structures
 * Also detects and prevents content duplication (doom loops)
 */
function cleanHtmlContent(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  let cleaned = html.trim();
  
  // Count occurrences to detect nested structures
  const htmlTagCount = (cleaned.match(/<html[^>]*>/gi) || []).length;
  const bodyTagCount = (cleaned.match(/<body[^>]*>/gi) || []).length;
  const bodyCloseCount = (cleaned.match(/<\/body>/gi) || []).length;
  
  // If we have multiple body tags, there might be nested structures
  // Extract only the outermost body content
  if (bodyTagCount > 0 && bodyCloseCount > 0) {
    // Find the first <body> tag
    const firstBodyIndex = cleaned.indexOf('<body');
    if (firstBodyIndex !== -1) {
      // Find the opening > of the first body tag
      const bodyTagEnd = cleaned.indexOf('>', firstBodyIndex);
      if (bodyTagEnd !== -1) {
        const bodyStart = bodyTagEnd + 1;
        // Find the last </body> tag (to handle nested structures)
        const bodyEnd = cleaned.lastIndexOf('</body>');
        
        if (bodyEnd > bodyStart) {
          cleaned = cleaned.substring(bodyStart, bodyEnd).trim();
          
          // Recursively clean if there are still nested structures
          // But limit recursion to prevent infinite loops
          const remainingBodyTags = (cleaned.match(/<body[^>]*>/gi) || []).length;
          if (remainingBodyTags > 0 && remainingBodyTags < bodyTagCount) {
            // There are still nested body tags, clean again but only once more
            cleaned = cleaned.replace(/<body[^>]*>/gi, '');
            cleaned = cleaned.replace(/<\/body>/gi, '');
          }
        }
      }
    }
  }
  
  // Remove any remaining DOCTYPE, html, head, or body tags that might be left
  // Do this in a way that doesn't create nested matches
  let previousLength = 0;
  let iterations = 0;
  while (iterations < 10 && cleaned.length !== previousLength) {
    previousLength = cleaned.length;
    cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');
    cleaned = cleaned.replace(/<html[^>]*>/gi, '');
    cleaned = cleaned.replace(/<\/html>/gi, '');
    cleaned = cleaned.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    cleaned = cleaned.replace(/<body[^>]*>/gi, '');
    cleaned = cleaned.replace(/<\/body>/gi, '');
    cleaned = cleaned.trim();
    iterations++;
  }
  
  // Detect and prevent content duplication (doom loops)
  // Strategy: Use a fingerprint of the first part of the content to detect repetition
  
  // Create a fingerprint from the first meaningful chunk (skip leading whitespace/tags)
  const contentStart = cleaned.search(/[^\s<]/);
  if (contentStart !== -1) {
    // Use first 2000 characters as fingerprint, or 1/4 of content, whichever is smaller
    const fingerprintLength = Math.min(2000, Math.max(500, Math.floor(cleaned.length / 4)));
    const fingerprint = cleaned.substring(contentStart, contentStart + fingerprintLength);
    
    // Find where this fingerprint repeats
    const secondOccurrence = cleaned.indexOf(fingerprint, contentStart + fingerprintLength);
    
    if (secondOccurrence !== -1 && secondOccurrence < cleaned.length * 0.85) {
      // Content is clearly duplicated - return only the first occurrence
      cleaned = cleaned.substring(0, secondOccurrence).trim();
      return cleaned;
    }
  }
  
  // Additional check: detect repeated patterns using common document markers
  const documentMarkers = [
    /#\s+Markdown\s+Test\s+Document/gi,
    /==\s+Bullet\s+list/gi,
    /##\s+Bullet\s+list/gi,
  ];
  
  for (const marker of documentMarkers) {
    const matches = cleaned.match(marker);
    if (matches && matches.length > 1) {
      const firstMatch = cleaned.search(marker);
      if (firstMatch !== -1) {
        // Get a chunk starting from this marker
        const chunkStart = firstMatch;
        const chunkLength = Math.min(1500, Math.floor(cleaned.length / 3));
        const chunk = cleaned.substring(chunkStart, chunkStart + chunkLength);
        
        // Find where this chunk repeats
        const secondChunk = cleaned.indexOf(chunk, chunkStart + chunkLength);
        
        if (secondChunk !== -1 && secondChunk < cleaned.length * 0.9) {
          // Content repeats here - truncate
          cleaned = cleaned.substring(0, secondChunk).trim();
          return cleaned;
        }
      }
    }
  }
  
  // Final check: detect repeated section headers
  const sectionHeaderPattern = /(?:^|\n)(?:##?|==)\s+[^\n<]+/gm;
  const sectionHeaders: string[] = [];
  let match;
  
  while ((match = sectionHeaderPattern.exec(cleaned)) !== null) {
    sectionHeaders.push(match[0].trim());
  }
  
  // If we have many headers, check for repetition
  if (sectionHeaders.length > 8) {
    const uniqueHeaders = new Set(sectionHeaders);
    // If we have way more headers than unique ones, content is repeating
    if (sectionHeaders.length > uniqueHeaders.size * 2.5) {
      // Find the first occurrence of each unique header
      const uniqueHeaderArray = Array.from(uniqueHeaders);
      const firstUniqueHeader = uniqueHeaderArray[0];
      const firstHeaderIndex = cleaned.indexOf(firstUniqueHeader);
      
      if (firstHeaderIndex !== -1) {
        // Find the second occurrence of the first header
        const secondHeaderIndex = cleaned.indexOf(firstUniqueHeader, firstHeaderIndex + 200);
        
        if (secondHeaderIndex !== -1 && secondHeaderIndex < cleaned.length * 0.85) {
          // Content repeats here - truncate
          cleaned = cleaned.substring(0, secondHeaderIndex).trim();
        }
      }
    }
  }
  
  return cleaned;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
