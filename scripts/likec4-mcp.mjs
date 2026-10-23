/**
 * Calls one tool of the likeC4 MCP server over stdio and prints its result:
 * how an agent with no MCP client configured (the weekly domain routine,
 * ADR 0040) reads the map. The server is a child process of this script,
 * never a port: `--http` has no authentication (CLAUDE.md, Structure,
 * modules and boundaries).
 *
 *   node scripts/likec4-mcp.mjs                       lists the tools
 *   node scripts/likec4-mcp.mjs <tool> '<json args>'  calls one, e.g.
 *   node scripts/likec4-mcp.mjs subgraph-summary '{"project":"blocksuite","elementId":"framework.std"}'
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [tool, args = '{}'] = process.argv.slice(2);

const server = spawn(
  join(ROOT, 'node_modules/.bin/likec4'),
  ['mcp', '--stdio', join(ROOT, 'architecture')],
  { stdio: ['pipe', 'pipe', 'ignore'] }
);
const send = message =>
  server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);

let buffer = '';
server.stdout.on('data', chunk => {
  buffer += chunk;
  for (let end; (end = buffer.indexOf('\n')) >= 0; ) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id === 1) {
      send({ method: 'notifications/initialized' });
      send(
        tool
          ? {
              id: 2,
              method: 'tools/call',
              params: { name: tool, arguments: JSON.parse(args) },
            }
          : { id: 2, method: 'tools/list' }
      );
    } else if (message.id === 2) {
      const { result, error } = message;
      console.log(
        JSON.stringify(
          error ??
            (tool
              ? (result.structuredContent ?? result.content)
              : result.tools.map(t => ({
                  name: t.name,
                  description: t.description,
                }))),
          null,
          1
        )
      );
      if (error || result.isError) process.exitCode = 1;
      server.kill();
    }
  }
});
send({
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'likec4-mcp.mjs', version: '1' },
  },
});
