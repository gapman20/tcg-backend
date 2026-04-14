const express = require('express');
const router = express.Router();

// TCGdex proxy - avoids CORS issues
router.get('/pokemon/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    const response = await fetch(
      `https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(q)}&pagination:itemsPerPage=${limit}`
    );
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('TCGdex search error:', error);
    res.status(500).json({ error: 'Failed to search cards' });
  }
});

router.get('/pokemon/card/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const response = await fetch(
      `https://api.tcgdex.net/v2/en/cards/${id}`
    );
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('TCGdex card error:', error);
    res.status(500).json({ error: 'Failed to get card' });
  }
});

module.exports = router;