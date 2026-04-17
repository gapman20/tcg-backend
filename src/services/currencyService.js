// Currency conversion using Frankfurter API
// Runs on backend to avoid CORS issues

const FRANKFURTER_API = 'https://api.frankfurter.app/latest';

// Cache the exchange rate
let cachedRate = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function getExchangeRate() {
  const now = Date.now();
  
  // Return cached rate if valid
  if (cachedRate && (now - cacheTime) < CACHE_DURATION) {
    return cachedRate;
  }
  
  try {
    // Use http instead of https to avoid redirect issues
    const response = await fetch(`${FRANKFURTER_API}?from=USD&to=MXN`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }
    
    const data = await response.json();
    cachedRate = data.rates.MXN;
    cacheTime = now;
    
    console.log(`[Currency] USD to MXN: ${cachedRate}`);
    return cachedRate;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return cachedRate || 20.0;
  }
}

module.exports = {
  getExchangeRate
};