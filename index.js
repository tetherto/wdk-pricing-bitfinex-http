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

'use strict'

import { PricingClient } from '@tetherto/wdk-pricing-provider'
import axios from 'axios'

/**
 * @typedef {import('@tetherto/wdk-pricing-provider').PricePair} PricePair
 * @typedef {import('@tetherto/wdk-pricing-provider').HistoricalPriceOptions} HistoricalPriceOptions
 * @typedef {import('@tetherto/wdk-pricing-provider').HistoricalPriceResult} HistoricalPriceResult
 * @typedef {import('@tetherto/wdk-pricing-provider').PriceData} PriceData
 */

export class BitfinexPricingClient extends PricingClient {
  /** @private */
  HISTORICAL_DATA_AGE = 365 * 24 * 60 * 60000

  /** @private */
  MAX_HISTORICAL_ENTRIES = 100

  constructor () {
    super()
    /** @private */
    this.client = axios.create({
      baseURL: 'https://api-pub.bitfinex.com/v2'
    })
  }

  /**
   * @param {string} from - Base currency (e.g. 'BTC')
   * @param {string} to - Quote currency (e.g. 'USD')
   * @returns {Promise<number|null>}
   */
  async getCurrentPrice (from, to) {
    const [price] = await this.getMultiCurrentPrices([{ from, to }])
    return price ?? null
  }

  /** @private */
  async _fxBatch (pairs) {
    const response = await this.client.post(
      '/calc/fx/batch',
      { pairs },
      {
        headers: {
          contentType: 'application/json',
          accept: 'application/json'
        }
      }
    )
    return response.data
  }

  /**
   * Builds a Bitfinex ticker symbol for a currency pair.
   * Bitfinex requires a colon separator when either symbol is longer than 3 characters
   * (e.g. tXAUT:USD instead of tXAUTUSD).
   * @private
   * @param {string} from - Base currency (e.g. 'BTC', 'XAUT')
   * @param {string} to - Quote currency (e.g. 'USD')
   * @returns {string} Bitfinex ticker symbol (e.g. 'tBTCUSD', 'tXAUT:USD')
   */
  _tickerFor (from, to) {
    const f = from.toUpperCase()
    const t = to.toUpperCase()
    if (f.length > 3 || t.length > 3) {
      return `t${f}:${t}`
    }
    return `t${f}${t}`
  }

  /**
   * Fetches the current conversion rate for multiple currency pairs in a single
   * batch request. Pairs that Bitfinex cannot convert directly (typically fiat
   * currencies it does not quote, e.g. BRL or ARS) resolve to `null`.
   * @param {PricePair[]} list - Array of currency pairs
   * @returns {Promise<Array<number|null>>} Prices in the same order as input pairs; `null` for pairs that cannot be resolved
   */
  async getMultiCurrentPrices (list) {
    return this._fxBatch(
      list.map((p) => ({
        ccy1: p.from.toUpperCase(),
        ccy2: p.to.toUpperCase(),
        amount: 1
      }))
    )
  }

  /**
   * Fetches full price data (last price, daily change, relative daily change)
   * for multiple currency pairs in a single batch request.
   * @param {PricePair[]} list - Array of currency pairs
   * @returns {Promise<Array<PriceData|null>>} Price data in the same order as input pairs; `null` for pairs not present in the response
   */
  async getMultiPriceData (list) {
    const symbols = list.map((p) => this._tickerFor(p.from, p.to)).join(',')

    const response = await this.client.get(`/tickers?symbols=${symbols}`)

    const SYMBOL_INDEX = 0
    const DAILY_CHANGE_INDEX = 5
    const DAILY_CHANGE_RELATIVE_INDEX = 6
    const LAST_PRICE_INDEX = 7

    const priceDataBySymbol = new Map()
    for (const ticker of response.data) {
      priceDataBySymbol.set(ticker[SYMBOL_INDEX], {
        lastPrice: ticker[LAST_PRICE_INDEX],
        dailyChange: ticker[DAILY_CHANGE_INDEX],
        dailyChangeRelative: ticker[DAILY_CHANGE_RELATIVE_INDEX]
      })
    }

    return list.map((p) => priceDataBySymbol.get(this._tickerFor(p.from, p.to)) ?? null)
  }

  /**
   * @param {string} from - Base currency (e.g. 'BTC')
   * @param {string} to - Quote currency (e.g. 'USD')
   * @param {HistoricalPriceOptions} [opts={}]
   * @returns {Promise<HistoricalPriceResult[]>}
   */
  async getHistoricalPrice (from, to, opts = {}) {
    if (
      opts.start &&
      opts.start < new Date().getTime() - this.HISTORICAL_DATA_AGE
    ) {
      throw new Error('Start date should be within last 365 days')
    }

    const start = opts.start
    const end = opts.end

    const results = []

    let cursor = end

    // Bitfinex returns data rounded to 1 hour, results are always in descending order
    while (Math.abs(cursor - start) > 3600000) {
      const response = await this.client.get(
        `/tickers/hist?symbols=${this._tickerFor(from, to)}&limit=100&start=${start}&end=${cursor}`
      )

      if (!response.data.length) {
        break
      }

      results.push(
        ...response.data.map((item) => ({
          price: item[3],
          ts: item[12]
        }))
      )

      const resultStart = response.data[response.data.length - 1][12]

      cursor = resultStart
    }

    return this._cappedToMaxResults(results)
  }

  /**
   * @private
   * @param {HistoricalPriceResult[]} results
   * @returns {HistoricalPriceResult[]}
   */
  _cappedToMaxResults (results) {
    if (results.length <= this.MAX_HISTORICAL_ENTRIES) {
      return results
    }

    return this._cappedToMaxResults(
      results.filter((_, index) => index % 2 === 0)
    )
  }
}
