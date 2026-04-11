// Server-Sent Events (SSE) utility for real-time admin notifications
// Manual implementation for better reliability

// Store all connected clients
const clients = new Set();

/**
 * SSE connection handler
 * Sets up proper SSE headers and manages client connections
 */
const sseHandler = (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial connection confirmation
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to SSE stream' })}\n\n`);

  // Add client to set
  clients.add(res);
  console.log(`[SSE] Client connected. Total clients: ${clients.size}`);

  // Send ping every 30 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 30000);

  // Remove client on disconnect
  req.on('close', () => {
    clients.delete(res);
    clearInterval(pingInterval);
    console.log(`[SSE] Client disconnected. Total clients: ${clients.size}`);
  });
};

/**
 * Emit event to all connected clients
 * @param {string} event - Event type (new_order, new_message, etc.)
 * @param {object} data - Event payload
 */
const emitEvent = (event, data) => {
  const payload = JSON.stringify({
    type: event,
    data,
    timestamp: new Date().toISOString(),
  });

  const message = `event: ${event}\ndata: ${payload}\n\n`;

  // Send to all connected clients
  for (const client of clients) {
    client.write(message);
  }

  console.log(`[SSE] Event emitted: ${event} to ${clients.size} clients`);
};

module.exports = {
  sseHandler,
  emitEvent,
};
