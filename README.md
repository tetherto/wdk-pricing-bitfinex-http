<p align="center" width="100">
<a href="https://github.com/tetherto/lib-wallet">
<img src="https://github.com/tetherto/lib-wallet/blob/main/docs/logo.svg" width="200"/>
</a>
</p>

# ⚛️ wdk-pricing-bitfinex-http

This library is an implementation of [wdk-pricing-provider](https://github.com/tetherto/lib-wallet-pricing-bitfinex-http) `PricingClient`. It uses Bitfinex [Public HTTP API](https://docs.bitfinex.com/docs/rest-public) to obtain the current price & historical data for given ticker.

## 📋 Table of Contents

- [⚛️ wdk-pricing-bitfinex-http](#️-wdk-pricing-bitfinex-http)
  - [📋 Table of Contents](#-table-of-contents)
  - [✨ Features](#-features)
  - [🚀 Installation](#-installation)
  - [💡 Quick Start](#-quick-start)
  - [🔍 Usage Examples](#-usage-examples)
  - [🔗 Related Projects](#-related-projects)

## ✨ Features

- Compatible with [wdk-pricing-provider](https://github.com/tetherto/lib-wallet-pricing-provider)
- Fetch current price for given ticker
- Fetch historical price for given ticker

## 🚀 Installation

```bash
npm install wdk-pricing-bitfinex-http
```

## 💡 Quick Start

```javascript
// Initialise the client
const client = new BitfinexPricingClient();

// Get latest price for BTCUSD/
const currentPrice = await client.getCurrentPrice("BTC", "USD");

// Get Hitorical price. If results are higher than MAX_HISTORICAL_ENTRIES (100), the response will be downscaled by x2
const historicalPrice = await client.getHistoricalPrice({
  from: "BTC",
  to: "USD",
  start: 1709906400000, // Optional, Start date for historical interval
  end: 1709913600000, // Optional, End date for historical interval
});
```

## 🔍 Usage Examples

For detailed usage examples, please check the included test file `index.test.js` of this repository.

## 🔗 Related Projects

This project is part of the [wdk](https://github.com/tetherto/lib-wallet) ecosystem. See the following projects for more information:

- [Lib Wallet Pricing Provider](https://github.com/tetherto/lib-wallet-pricing-provider)
