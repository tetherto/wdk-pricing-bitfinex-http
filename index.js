"use strict";
// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

import { PricingClient } from "@tetherto/wdk-pricing-provider";
import axios from "axios";

/**
 * @typedef {Object} CurrencyPair
 * @property {string} from Base currency (e.g. 'BTC')
 * @property {string} to Quote currency (e.g. 'USD')
 */

/**
 * @typedef {Object} HistoricalPriceOptions
 * @property {number} start Start of the time range as a Unix timestamp in milliseconds
 * @property {number} end End of the time range as a Unix timestamp in milliseconds
 */

/**
 * @typedef {Object} HistoricalPriceResult
 * @property {number} price Asset price at the given timestamp
 * @property {number} timestamp Unix timestamp in milliseconds
 */

export class BitfinexPricingClient extends PricingClient {
  /** @internal */
  HISTORICAL_DATA_AGE = 365 * 24 * 60 * 60000;

  /** @internal */
  MAX_HISTORICAL_ENTRIES = 100;

  constructor() {
    super();
    /** @internal */
    this.client = axios.create({
      baseURL: "https://api-pub.bitfinex.com/v2",
    });
  }

  /**
   * @param {string} from - Base currency (e.g. 'BTC')
   * @param {string} to - Quote currency (e.g. 'USD')
   * @returns {Promise<number>}
   */
  async getCurrentPrice(from, to) {
    const response = await this.client.post(
      "/calc/fx",
      {
        ccy1: from.toUpperCase(),
        ccy2: to.toUpperCase(),
      },
      {
        headers: {
          contentType: "application/json",
          accept: "application/json",
        },
      },
    );
    return response.data[0];
  }

  /**
   * @param {CurrencyPair[]} pairs - Array of currency pairs
   * @returns {Promise<number[]>} Array of prices in the same order as input pairs
   */
  async getMultiCurrentPrice(pairs) {
    const symbols = pairs
      .map((p) => `t${p.from.toUpperCase()}${p.to.toUpperCase()}`)
      .join(",");

    const response = await this.client.get(`/tickers?symbols=${symbols}`);

    const SYMBOL_INDEX = 0;
    const LAST_PRICE_INDEX = 7;
    const priceBySymbol = new Map();

    for (const ticker of response.data) {
      priceBySymbol.set(ticker[SYMBOL_INDEX], ticker[LAST_PRICE_INDEX]);
    }

    return pairs.map((p) => {
      const symbol = `t${p.from.toUpperCase()}${p.to.toUpperCase()}`;
      return priceBySymbol.get(symbol);
    });
  }

  /**
   * Fetches full price data (last price, daily change, relative daily change)
   * for multiple currency pairs in a single batch request.
   * @param {CurrencyPair[]} pairs - Array of currency pairs
   * @returns {Promise<import('@tetherto/wdk-pricing-provider').PriceData[]>} Price data in the same order as input pairs
   */
  async getMultiPriceData(pairs) {
    const symbols = pairs
      .map((p) => `t${p.from.toUpperCase()}${p.to.toUpperCase()}`)
      .join(",");

    const response = await this.client.get(`/tickers?symbols=${symbols}`);

    const SYMBOL_INDEX = 0;
    const DAILY_CHANGE_INDEX = 5;
    const DAILY_CHANGE_RELATIVE_INDEX = 6;
    const LAST_PRICE_INDEX = 7;

    const priceDataBySymbol = new Map();
    for (const ticker of response.data) {
      priceDataBySymbol.set(ticker[SYMBOL_INDEX], {
        lastPrice: ticker[LAST_PRICE_INDEX],
        dailyChange: ticker[DAILY_CHANGE_INDEX],
        dailyChangeRelative: ticker[DAILY_CHANGE_RELATIVE_INDEX],
      });
    }

    return pairs.map((p) => {
      const symbol = `t${p.from.toUpperCase()}${p.to.toUpperCase()}`;
      return priceDataBySymbol.get(symbol);
    });
  }

  /**
   * @param {string} from - Base currency (e.g. 'BTC')
   * @param {string} to - Quote currency (e.g. 'USD')
   * @param {HistoricalPriceOptions} [opts={}] - Optional time range
   * @returns {Promise<HistoricalPriceResult[]>}
   */
  async getHistoricalPrice(from, to, opts = {}) {
    if (
      opts.start &&
      opts.start < new Date().getTime() - this.HISTORICAL_DATA_AGE
    ) {
      throw new Error("Start date should be within last 365 days");
    }

    const start = opts.start;
    const end = opts.end;

    const results = [];

    let cursor = end;

    // Bitfinex returns data rounded to 1 hour, results are always in descending order
    while (Math.abs(cursor - start) > 3600000) {
      const response = await this.client.get(
        `/tickers/hist?symbols=t${from}${to}&limit=100&start=${start}&end=${cursor}`,
      );

      if (!response.data.length) {
        break;
      }

      results.push(
        ...response.data.map((item) => ({
          price: item[3],
          ts: item[12],
        })),
      );

      const resultStart = response.data[response.data.length - 1][12];

      cursor = resultStart;
    }

    return this._cappedToMaxResults(results);
  }

  /**
   * @internal
   * @param {HistoricalPriceResult[]} results
   * @returns {HistoricalPriceResult[]}
   */
  _cappedToMaxResults(results) {
    if (results.length <= this.MAX_HISTORICAL_ENTRIES) {
      return results;
    }

    return this._cappedToMaxResults(
      results.filter((_, index) => index % 2 === 0),
    );
  }
}
