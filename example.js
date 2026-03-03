#!/usr/bin/env node

/**
 * Example usage of gc-parser
 * This can be called from Go or used directly in Node.js
 */

const { Parser, defaultOptions } = require('./dist/index.js');

async function main() {
  // Create parser with default options
  const opts = defaultOptions();
  opts.linkBaseURL = process.env.LINK_BASE_URL || 'https://example.com';

  const parser = new Parser(opts);

  // Get content from command line argument or stdin
  let content = '';
  if (process.argv[2]) {
    content = process.argv[2];
  } else {
    // Read from stdin
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    for await (const line of rl) {
      content += line + '\n';
    }
  }

  if (!content) {
    console.error('No content provided');
    process.exit(1);
  }

  try {
    const result = await parser.process(content);
    
    // Output as JSON for easy parsing
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error processing content:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
