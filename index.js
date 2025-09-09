'use strict'

import axios from 'axios'
import { PricingClient } from 'lib-wallet-pricing-provider'

export class BitfinexPricingClient extends PricingClient {
  HISTORICAL_DATA_AGE = 365 * 24 * 60 * 60000
  MAX_HISTORICAL_ENTRIES = 100

  /**
   * Creates a new BitfinexPricingClient instance.
   */
  constructor () {
    super()
    this.client = axios.create({
      baseURL: 'https://api-pub.bitfinex.com/v2'
    })
  }

  /**
   * Returns the current price of the asset pair
   * @async
   * @param {string} from
   * @param {string} to
   * @returns {Promise<number>}
   */
  async getCurrentPrice (from, to) {
    const response = await this.client.post('/calc/fx', {
      ccy1: from.toUpperCase(),
      ccy2: from.toUpperCase()
    }, {
      headers: {
        contentType: 'application/json',
        accept: 'application/json'
      }
    })
    return response.data[0]
  }

  /**
   * Returns the recorded lowest ask (not trade) of the asset pair.
   * Bitfinex only supports max 250 records per request.
   * @async
   * @param {HistoricalPriceOptions} opts
   * @returns {Promise<HistoricalPriceResult[]>}
   */
  async getHistoricalPrice (opts) {
    if (
      opts.start &&
      opts.start < new Date().getTime() - this.HISTORICAL_DATA_AGE
    ) {
      throw new Error('Start date should be within last 365 days')
    }

    const start = opts?.start
    const end = opts?.end

    const results = []

    let cursor = end

    // Bitfixes returns data rounded to 1 hour && results are always in descending order
    while (Math.abs(cursor - start) > 3600000) {
      const response = await this.client.get(
        `/tickers/hist?symbols=t${opts.from}${opts.to}&limit=100&start=${start}&end=${cursor}`
      )

      if (!response.data.length) {
        break
      }

      results.push(
        ...response.data.map(item => ({
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
   * Cuts the results to the maximum number of entries.
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
