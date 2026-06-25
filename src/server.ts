#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerTools } from './register-tool.js';

const server = new McpServer({
  name: 'ci-investigator',
  version: '1.0.0',
});

registerTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ci-investigator MCP server running');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
