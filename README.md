# Lib Wallet Pricing - Bitfinex HTTP

This library is an implementation of [lib-wallet-pricing-provider](https://github.com/tetherto/lib-wallet-pricing-bitfinex-http) `PricingClient`. It exposes methods to obtain the current price & historical data for given ticker.

## Installation

1. Install the required dependencies:

```bash
npm install lib-wallet-pricing-bitfinex-http
```

## Usage

```js
// Initialise the client
const client = new BitfinexPricingClient();

// Get latest price for BTCUSD/
const currentPrice = await client.getCurrentPrice('BTC', 'USD');

// Get Hitorical price. If results are higher than MAX_HISTORICAL_ENTRIES (100), the response will be downscaled by x2
const historicalPrice = await client.getHistoricalPrice({
  from: 'BTC',
  to: 'USD',
  start: 1709906400000, // Optional, Start date for historical interval
  end: 1709913600000, // Optional, End date for historical interval
});
```
