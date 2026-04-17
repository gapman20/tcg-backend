const express = require('express');
const router = express.Router();

const POKEWALLET_BASE_URL = 'https://api.pokewallet.io';

// Helper to get API key from request or environment
const getApiKey = (req) => {
  // First try header from frontend
  if (req.headers['x-api-key']) {
    return req.headers['x-api-key'];
  }
  // Then try environment variable (without VITE prefix)
  const envKey = process.env.POKEWALLET_API_KEY || process.env.VITE_POKEWALLET_API_KEY;
  console.log('[PokéWallet] API Key from env:', envKey ? 'present' : 'missing');
  return envKey || '';
};

// Add CORS headers for image responses
router.use('/images/:id', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  next();
});

// Handle preflight for images
router.options('/images/:id', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  res.sendStatus(200);
});

// Proxy for searching cards
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const apiKey = getApiKey(req);
    
    const response = await fetch(
      `${POKEWALLET_BASE_URL}/search?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`PokéWallet API Error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('PokéWallet search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy for card details
router.get('/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const apiKey = getApiKey(req);
    
    const response = await fetch(
      `${POKEWALLET_BASE_URL}/cards/${id}`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`PokéWallet API Error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('PokéWallet card error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy for images (solves CORS issues)
router.get('/images/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { size = 'high' } = req.query;
    const apiKey = getApiKey(req);

    const response = await fetch(
      `${POKEWALLET_BASE_URL}/images/${id}?size=${size}`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`PokéWallet Image Error: ${response.status}`);
    }

    // Get the image as buffer instead of streaming
    const buffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    // Set proper content type and CORS headers
    const contentType = response.headers.get('content-type') || 'image/png';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    
    // Send the image buffer
    res.send(Buffer.from(uint8Array));
  } catch (error) {
    console.error('PokéWallet image proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sets
router.get('/sets', async (req, res) => {
  try {
    const apiKey = getApiKey(req);
    
    const response = await fetch(
      `${POKEWALLET_BASE_URL}/sets`,
      {
        headers: {
          'X-API-Key': apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`PokéWallet API Error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('PokéWallet sets error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;