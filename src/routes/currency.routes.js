const express = require('express');
const router = express.Router();
const { getExchangeRate } = require('../services/currencyService');

// Get current USD to MXN exchange rate
router.get('/exchange-rate', async (req, res) => {
  try {
    const rate = await getExchangeRate();
    res.json({ rate, from: 'USD', to: 'MXN' });
  } catch (error) {
    console.error('Error getting exchange rate:', error);
    res.status(500).json({ error: 'Failed to get exchange rate', fallback: 20.0 });
  }
});

module.exports = router;