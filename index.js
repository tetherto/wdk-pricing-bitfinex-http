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

/**
 * The options accepted by `BitfinexPricingClient`.
 *
 * @typedef {Object} BitfinexPricingClientOptions
 * @property {Record<string, string>} [currencyCodes] - Common-symbol-to-Bitfinex-currency-code
 *   overrides, merged over the built-in defaults (e.g. `{ USDT0: 'UST' }`). Keys and
 *   values are upper-cased.
 */

/**
 * Translates the common ticker symbol callers pass to `PricingClient` methods
 * into the currency code Bitfinex expects. It holds the symbols Bitfinex publishes
 * under more than one code; everything else is resolved from {@link CURRENCY_MAP_PATH}.
 *
 * @type {Record<string, string>}
 */
const DEFAULT_CURRENCY_CODES = {
  USDT: 'UST',
  WBTC: 'WBT',
  WBT: 'WHBT',
  OP: 'OPX',
  ALGO: 'ALG',
  DASH: 'DSH',
  IOTA: 'IOT'
}

/**
 * The Bitfinex endpoint publishing its currency-code aliases.
 *
 * @type {string}
 */
const CURRENCY_MAP_PATH = '/conf/pub:map:currency:sym'

/**
 * Reverses Bitfinex's published aliases into a common-symbol-to-currency-code map.
 * Test and derivative codes are ignored, and a symbol claimed by more than one code
 * is left out so the lookup falls back to the symbol itself.
 *
 * @param {[string, string][]} aliases - Bitfinex currency code and common symbol pairs.
 * @returns {Map<string, string>} Currency codes keyed by common ticker symbol.
 */
function toCurrencyCodeMap (aliases) {
  const codesBySymbol = new Map()

  for (const [code, symbol] of aliases) {
    if (code.startsWith('TEST') || code.endsWith('F0')) {
      continue
    }

    const key = symbol.toUpperCase()
    codesBySymbol.set(key, codesBySymbol.has(key) ? null : code)
  }

  return new Map([...codesBySymbol].filter(([, code]) => code !== null))
}

export class BitfinexPricingClient extends PricingClient {
  /** @private */
  HISTORICAL_DATA_AGE = 365 * 24 * 60 * 60000

  /** @private */
  MAX_HISTORICAL_ENTRIES = 100

  /** @private */
  MAX_HISTORICAL_PAGES = 100

  /**
   * Creates a Bitfinex pricing client.
   *
   * @param {BitfinexPricingClientOptions} [options] - Currency-code overrides applied over the built-in defaults (default: none).
   */
  constructor (options = {}) {
    super()
    /** @private */
    this.client = axios.create({
      baseURL: 'https://api-pub.bitfinex.com/v2'
    })

    /** @private */
    this._currencyCodes = { ...DEFAULT_CURRENCY_CODES }
    for (const [symbol, code] of Object.entries(options.currencyCodes ?? {})) {
      this._currencyCodes[symbol.toUpperCase()] = code.toUpperCase()
    }

    /** @private */
    this._apiCodesPromise = null
  }

  /** @private */
  _apiCurrencyCodes () {
    if (!this._apiCodesPromise) {
      this._apiCodesPromise = this.client
        .get(CURRENCY_MAP_PATH)
        .then((response) => toCurrencyCodeMap(response.data[0]))
        .catch(() => {
          // Leave the lookup working without the aliases, and retry on the next lookup.
          this._apiCodesPromise = null
          return new Map()
        })
    }

    return this._apiCodesPromise
  }

  /** @private */
  async _currencyCode (symbol) {
    const upper = symbol.toUpperCase()

    if (this._currencyCodes[upper]) {
      return this._currencyCodes[upper]
    }

    const apiCodes = await this._apiCurrencyCodes()

    return apiCodes.get(upper) ?? upper
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
   * @returns {Promise<string>} Bitfinex ticker symbol (e.g. 'tBTCUSD', 'tXAUT:USD', 'tUSTUSD' for USDT)
   */
  async _tickerFor (from, to) {
    const [f, t] = await Promise.all([this._currencyCode(from), this._currencyCode(to)])
    if (f.length > 3 || t.length > 3) {
      return `t${f}:${t}`
    }
    return `t${f}${t}`
  }

  /**
   * Fetches the current conversion rate for multiple currency pairs in a single
   * batch request. Symbols are translated to Bitfinex currency codes first (e.g.
   * USDT to UST); symbols without a translation are sent unchanged. Pairs that
   * Bitfinex cannot convert directly (typically fiat currencies it does not
   * quote, e.g. BRL or ARS) resolve to `null`.
   * @param {PricePair[]} list - Array of currency pairs
   * @returns {Promise<Array<number|null>>} Prices in the same order as input pairs; `null` for pairs that cannot be resolved
   */
  async getMultiCurrentPrices (list) {
    const pairs = await Promise.all(
      list.map(async (p) => {
        const [ccy1, ccy2] = await Promise.all([
          this._currencyCode(p.from),
          this._currencyCode(p.to)
        ])

        return { ccy1, ccy2, amount: 1 }
      })
    )

    return this._fxBatch(pairs)
  }

  /**
   * Fetches full price data (last price, daily change, relative daily change)
   * for multiple currency pairs in a single batch request. Symbols are translated
   * to Bitfinex currency codes first (e.g. USDT to UST).
   * @param {PricePair[]} list - Array of currency pairs
   * @returns {Promise<Array<PriceData|null>>} Price data in the same order as input pairs; `null` for pairs not present in the response
   */
  async getMultiPriceData (list) {
    const tickers = await Promise.all(list.map((p) => this._tickerFor(p.from, p.to)))
    const symbols = tickers.join(',')

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

    return tickers.map((ticker) => priceDataBySymbol.get(ticker) ?? null)
  }

  /**
   * @param {string} from - Base currency (e.g. 'BTC')
   * @param {string} to - Quote currency (e.g. 'USD')
   * @param {HistoricalPriceOptions} [opts={}]
   * @returns {Promise<HistoricalPriceResult[]>}
   */
  async getHistoricalPrice (from, to, opts = {}) {
    if (
      opts.start != null &&
      opts.start < new Date().getTime() - this.HISTORICAL_DATA_AGE
    ) {
      throw new Error('Start date should be within last 365 days')
    }

    const start = opts.start
    const end = opts.end
    const ticker = await this._tickerFor(from, to)

    const results = []

    let cursor = end
    let pages = 0

    // Bitfinex returns data rounded to 1 hour, results are always in descending order
    while (Math.abs(cursor - start) > 3600000 && pages < this.MAX_HISTORICAL_PAGES) {
      pages++

      const response = await this.client.get(
        `/tickers/hist?symbols=${ticker}&limit=100&start=${start}&end=${cursor}`
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

      if (!(resultStart < cursor)) {
        break
      }

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
