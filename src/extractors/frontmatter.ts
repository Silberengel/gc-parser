/**
 * Extracts front matter from content
 * Handles both YAML front matter (--- ... ---) and AsciiDoc document header attributes (:key: value)
 * Returns the front matter object and the content
 * For YAML: removes front matter from content
 * For AsciiDoc: removes header from content and extracts as metadata (prevents header from appearing in rendered output)
 */
export function extractFrontmatter(content: string): { frontmatter?: Record<string, any>; content: string } {
  // First, try to match YAML front matter: ---\n...\n---
  const yamlFrontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
  const yamlMatch = content.match(yamlFrontmatterRegex);
  
  if (yamlMatch) {
    const yamlContent = yamlMatch[1];
    const contentWithoutFrontmatter = yamlMatch[2];
  
    // Simple YAML parser for basic key-value pairs and arrays
    // This is a basic implementation - for complex YAML, consider using a library
    const frontmatter: Record<string, any> = {};
    const lines = yamlContent.split('\n');
    let currentKey: string | null = null;
    let inArray = false;
    let arrayKey: string | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        if (inArray && trimmed === '') {
          // Empty line might end the array
          inArray = false;
          arrayKey = null;
        }
        continue;
      }
      
      // Array item (line starting with -)
      if (trimmed.startsWith('- ')) {
        const item = trimmed.substring(2).trim();
        const cleanItem = item.replace(/^["']|["']$/g, '');
        
        if (arrayKey && frontmatter[arrayKey]) {
          frontmatter[arrayKey].push(cleanItem);
        } else if (currentKey) {
          // Start new array
          arrayKey = currentKey;
          inArray = true;
          frontmatter[currentKey] = [cleanItem];
        }
        continue;
      }
      
      // Key-value pair
      const keyValueMatch = trimmed.match(/^(\w+):\s*(.+)$/);
      if (keyValueMatch) {
        const key = keyValueMatch[1];
        let value = keyValueMatch[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        frontmatter[key] = value;
        currentKey = key;
        inArray = false;
        arrayKey = null;
        continue;
      }
    }
  
    return { frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : undefined, content: contentWithoutFrontmatter };
  }
  
  // If no YAML front matter, try to extract AsciiDoc document header attributes
  // AsciiDoc format: = Title\nAuthor\nRevision\n:attribute: value\n...
  // Match header lines until we hit a blank line (which separates header from body)
  // The header consists of: title line, optional author/revision lines, and attribute lines
  const lines = content.split('\n');
  let headerEndIndex = 0;
  
  // Find where the header ends (first blank line after title/attributes)
  if (lines[0] && lines[0].match(/^=+\s+/)) {
    // We have a title line, now find where header ends
    let i = 1;
    // Skip author and revision lines (non-empty lines that don't start with :)
    while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith(':')) {
      i++;
    }
    // Now skip attribute lines (lines starting with :)
    while (i < lines.length && lines[i].trim().startsWith(':')) {
      i++;
    }
    // Skip the blank line that separates header from body
    if (i < lines.length && lines[i].trim() === '') {
      i++;
    }
    headerEndIndex = i;
  }
  
  // If we found a header, extract it
  if (headerEndIndex > 0) {
    const headerLines = lines.slice(0, headerEndIndex);
    const headerContent = headerLines.join('\n');
    const contentWithoutHeader = lines.slice(headerEndIndex).join('\n');
    
    const frontmatter: Record<string, any> = {};
    const headerLinesArray = headerContent.split('\n');
    
    // Extract title (first line starting with =)
    const titleMatch = headerLinesArray[0].match(/^=+\s+(.+)$/);
    if (titleMatch) {
      frontmatter.title = titleMatch[1].trim();
    }
    
    // Extract author (line after title, if it doesn't start with :)
    if (headerLinesArray.length > 1 && !headerLinesArray[1].trim().startsWith(':')) {
      const authorLine = headerLinesArray[1].trim();
      if (authorLine && !authorLine.match(/^[\d.,\s:]+$/)) {
        // Not a revision line (which has numbers, commas, colons)
        frontmatter.author = authorLine;
      }
    }
    
    // Extract revision (line with version, date, remark format: "2.9, October 31, 2021: Fall incarnation")
    for (let i = 1; i < headerLinesArray.length; i++) {
      const line = headerLinesArray[i].trim();
      if (line.match(/^[\d.,\s:]+$/)) {
        // This looks like a revision line
        const revisionMatch = line.match(/^([^,]+),\s*([^:]+)(?::\s*(.+))?$/);
        if (revisionMatch) {
          frontmatter.version = revisionMatch[1].trim();
          frontmatter.date = revisionMatch[2].trim();
          if (revisionMatch[3]) {
            frontmatter.revision = revisionMatch[3].trim();
          }
        }
        break;
      }
    }
    
    // Extract AsciiDoc attributes (:key: value)
    for (const line of headerLinesArray) {
      const trimmed = line.trim();
      if (trimmed.startsWith(':') && trimmed.includes(':')) {
        const attrMatch = trimmed.match(/^:([^:]+):\s*(.+)$/);
        if (attrMatch) {
          const key = attrMatch[1].trim();
          let value = attrMatch[2].trim();
          
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          // Handle comma-separated values (like keywords)
          if (value.includes(',') && !value.includes(' ')) {
            frontmatter[key] = value.split(',').map((v: string) => v.trim());
          } else {
            frontmatter[key] = value;
          }
        }
      }
    }
    
    // For AsciiDoc, remove the header from content to prevent it from appearing in rendered output
    // AsciiDoctor can work without the header, and we've already extracted the metadata
    return { frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : undefined, content: contentWithoutHeader };
  }
  
  // No front matter found
  return { content };
}
