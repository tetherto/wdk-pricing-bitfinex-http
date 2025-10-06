# @tetherto/wdk-pricing-bitfinex-http

Note: This package is in beta. Please test in a dev setup first.

HTTP client for prices from Bitfinex, it uses [Bitfinex Public HTTP API](https://docs.bitfinex.com/docs/rest-public) to obtain the current price & historical data for given ticker.

It works as a `PricingClient` for [`@tetherto/wdk-pricing-provider`](https://github.com/tetherto/lib-wallet-pricing-bitfinex-http).

## 🔍 About WDK

This module is part of the WDK (Wallet Development Kit) project. Learn more at https://docs.wallet.tether.io.

## ✨ Features

- Compatible with [@tetherto/wdk-pricing-provider](https://github.com/tetherto/lib-wallet-pricing-provider)
- Fetch current price for given ticker
- Fetch historical prices given ticker
- Downscales long history to max 100 points

## ⬇️ Installation

```bash
npm install @tetherto/wdk-pricing-bitfinex-http
```

## 🚀 Quick Start

```javascript
import { BitfinexPricingClient } from "@tetherto/wdk-pricing-bitfinex-http";

// Create the client
const client = new BitfinexPricingClient();

// Get latest price
const current = await client.getCurrentPrice("BTC", "USD");

// Get historical prices
const history = await client.getHistoricalPrice({
  from: "BTC",
  to: "USD",
  start: 1709906400000, // optional
  end: 1709913600000, // optional
});
```

## 📚 API Reference

### BitfinexPricingClient

Simple HTTP pricing client for Bitfinex.

#### Constructor

```javascript
new BitfinexPricingClient(options?)
```

Parameters:

- `options` (optional): future use

### Methods

| Method                                           | Description       | Returns               |
| ------------------------------------------------ | ----------------- | --------------------- |
| `getCurrentPrice(base, quote)`                   | Get latest price  | `Promise<number>`     |
| `getHistoricalPrice({ from, to, start?, end? })` | Get price history | `Promise<Array<any>>` |

#### `getCurrentPrice(base, quote)`

```javascript
const price = await client.getCurrentPrice("BTC", "USD");
```

#### `getHistoricalPrice({ from, to, start?, end? })`

If the list is longer than 100 points, it is downscaled by 2x steps until <= 100.

```javascript
const series = await client.getHistoricalPrice({ from: "BTC", to: "USD" });
```

## 🛠️ Development

```bash
npm install
npm run lint
npm test
```

## 📜 License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🆘 Support

For support, please open an issue on the GitHub repository.
