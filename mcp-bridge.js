// mcp-bridge.js
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  SSEClientTransport,
} = require("@modelcontextprotocol/sdk/client/sse.js");
const { EventSource } = require("eventsource");

// Polyfill EventSource for Node environment
global.EventSource = EventSource;

async function main() {
  const args = process.argv.slice(2);
  let urlStr = "";
  let apiKey = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) {
      urlStr = args[i + 1];
      i++;
    } else if (args[i] === "--key" && args[i + 1]) {
      apiKey = args[i + 1];
      i++;
    }
  }

  if (!urlStr) {
    console.error("Error: --url parameter is required.");
    process.exit(1);
  }

  const url = new URL(urlStr);
  if (
    apiKey &&
    apiKey !== "agv_live_YOUR_RAW_SECRET_KEY" &&
    !url.searchParams.has("key")
  ) {
    url.searchParams.set("key", apiKey);
  }

  console.error(`MCP Bridge Started... Connecting to ${url.origin}...`);

  const localTransport = new StdioServerTransport();
  const remoteTransport = new SSEClientTransport(url);

  localTransport.onmessage = (message) => {
    remoteTransport.send(message).catch((err) => {
      console.error("Error forwarding message to remote server:", err);
    });
  };

  remoteTransport.onmessage = (message) => {
    localTransport.send(message).catch((err) => {
      console.error("Error forwarding message to local client:", err);
    });
  };

  localTransport.onclose = () => {
    console.error("Local stdio connection closed.");
    remoteTransport.close().catch(() => {});
    process.exit(0);
  };

  remoteTransport.onclose = () => {
    console.error("Remote SSE connection closed.");
    localTransport.close().catch(() => {});
    process.exit(0);
  };

  localTransport.onerror = (err) =>
    console.error("Local transport error:", err);
  remoteTransport.onerror = (err) =>
    console.error("Remote transport error:", err);

  try {
    await remoteTransport.start();
    console.error("Connected to remote MCP server via SSE.");
    await localTransport.start();
    console.error("Stdio bridge active.");
  } catch (err) {
    console.error("Failed to connect MCP bridge:", err.message);
    process.exit(1);
  }
}

main();
