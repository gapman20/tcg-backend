// Server-Sent Events (SSE) utility for real-time admin notifications
const SSE = require('express-sse');

// Create SSE instance with initial empty data
const sse = new SSE([], {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});

/**
 * Emit event to all connected admin clients
 * @param {string} event - Event type (new_order, new_message, etc.)
 * @param {object} data - Event payload
 */
const emitEvent = (event, data) => {
  const payload = {
    type: event,
    data,
    timestamp: new Date().toISOString(),
  };
  
  sse.send(payload, event);
  console.log(`[SSE] Event emitted: ${event}`);
};

/**
 * SSE middleware for admin events endpoint
 */
const sseMiddleware = (req, res, next) => {
  // Set headers for SSE
  req.sse = sse;
  next();
};

module.exports = {
  sse,
  sseMiddleware,
  emitEvent,
};
