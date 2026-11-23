'use strict'
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

import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import axios from 'axios'
import { BitfinexPricingClient } from '../index'

const REQUEST_HEADERS = {
  headers: {
    contentType: 'application/json',
    accept: 'application/json'
  }
}

const DUMMY_UST_PRICE = 1.0004
const DUMMY_WBT_PRICE = 85094.5
const DUMMY_BTC_UST_PRICE = 83869

// Each row isolates one rule, so no two can mask each other.
const DUMMY_CURRENCY_ALIASES = [
  ['USE', 'USDt'],       // sole claimant, and disagrees with the USDT default
  ['ATO', 'atom'],       // lower-case symbol
  ['XAUTA', 'XAUt'],     // first claimant differs from the symbol...
  ['XAUT0BNB', 'XAUt'],  // ...so a conflict must drop rather than take the first
  ['TESTBTC', 'BTC'],    // only a test code claims BTC
  ['LNXF0', 'LNX'],      // only a derivative code claims LNX
  ['XAUTX', 'goldt']     // resolves to a code longer than three characters
]

describe('BitfinexPricingClient', () => {
  let client
  let mockGet
  let mockPost
  let mockConfGet

  beforeEach(() => {
    // Create a mock get function for historical data
    mockGet = jest.fn().mockResolvedValue({
      data: [
        'tBTCUSD', // [0] SYMBOL
        163000.12345, // [1] BID
        100.12345, // [2] BID_SIZE
        164000.12345, // [3] ASK
        100.12345, // [4] ASK_SIZE
        -123.12345, // [5] DAILY_CHANGE
        165000.12345, // [6] LAST_PRICE <-- This is what we want
        12345.12345, // [7] VOLUME
        166000.12345, // [8] HIGH
        162000.12345 // [9] LOW
      ]
    })
    // Create a mock post function for FX batch conversions
    mockPost = jest.fn().mockResolvedValue({
      data: [165000.12345]
    })

    // Mock axios.create to return an object with our mock get function for historical data
    // Served separately, so each test configures only the pricing responses it cares about.
    mockConfGet = jest.fn().mockResolvedValue({ data: [DUMMY_CURRENCY_ALIASES] })

    axios.create = jest.fn().mockReturnValue({
      get: jest.fn((path, ...rest) =>
        path.startsWith('/conf/') ? mockConfGet(path, ...rest) : mockGet(path, ...rest)
      ),
      post: mockPost
    })

    client = new BitfinexPricingClient()
  })

  describe('getCurrentPrice', () => {
    it('should return the current price from the Bitfinex FX batch API', async () => {
      const price = await client.getCurrentPrice('BTC', 'USD')

      expect(price).toBe(165000.12345)
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api-pub.bitfinex.com/v2'
      })
      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'BTC', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should return null (not undefined) when a pair cannot be resolved', async () => {
      mockPost
        .mockReset()
        .mockResolvedValueOnce({ data: [null] }) // BTC->XYZ not supported

      const price = await client.getCurrentPrice('BTC', 'XYZ')

      expect(price).toBeNull()
    })

    it('should translate USDT to the Bitfinex UST code', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [DUMMY_UST_PRICE] })

      const price = await client.getCurrentPrice('USDT', 'USD')

      expect(price).toBe(DUMMY_UST_PRICE)
      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'UST', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })
  })

  describe('getMultiCurrentPrices', () => {
    it('should return prices for multiple pairs from the FX batch API', async () => {
      mockPost.mockReset().mockResolvedValue({
        data: [165000.12345, 3005.6789]
      })

      const prices = await client.getMultiCurrentPrices([
        { from: 'BTC', to: 'USD' },
        { from: 'ETH', to: 'USD' }
      ])

      expect(prices).toEqual([165000.12345, 3005.6789])
      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [
          { ccy1: 'BTC', ccy2: 'USD', amount: 1 },
          { ccy1: 'ETH', ccy2: 'USD', amount: 1 }
        ]
      }, REQUEST_HEADERS)
    })

    it('should handle single pair', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [165000] })

      const prices = await client.getMultiCurrentPrices([{ from: 'BTC', to: 'USD' }])

      expect(prices).toEqual([165000])
      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'BTC', ccy2: 'USD', amount: 1 }]
      }, expect.anything())
    })

    it('should convert currency codes to uppercase', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [165000] })

      await client.getMultiCurrentPrices([{ from: 'btc', to: 'usd' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'BTC', ccy2: 'USD', amount: 1 }]
      }, expect.anything())
    })

    it('should translate a common quote symbol to its Bitfinex currency code', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [DUMMY_BTC_UST_PRICE] })

      await client.getMultiCurrentPrices([{ from: 'BTC', to: 'USDT' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'BTC', ccy2: 'UST', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should translate lower-case symbols', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [DUMMY_UST_PRICE] })

      await client.getMultiCurrentPrices([{ from: 'usdt', to: 'usd' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'UST', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it.each([
      ['USDT', 'UST'],
      ['WBTC', 'WBT'],
      ['WBT', 'WHBT'],
      ['OP', 'OPX'],
      ['ALGO', 'ALG'],
      ['DASH', 'DSH'],
      ['IOTA', 'IOT']
    ])('should translate %s to the Bitfinex code %s by default', async (symbol, code) => {
      mockPost.mockReset().mockResolvedValue({ data: [1] })

      await client.getMultiCurrentPrices([{ from: symbol, to: 'USD' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: code, ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should send symbols without a translation unchanged', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [2700, 1.5] })

      await client.getMultiCurrentPrices([
        { from: 'XAUT', to: 'USD' },
        { from: 'TON', to: 'USD' }
      ])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [
          { ccy1: 'XAUT', ccy2: 'USD', amount: 1 },
          { ccy1: 'TON', ccy2: 'USD', amount: 1 }
        ]
      }, REQUEST_HEADERS)
    })

    it('should return null for pairs Bitfinex cannot quote directly without extra requests', async () => {
      mockPost
        .mockReset()
        // BTC->USD ok, BTC->BRL not supported (null)
        .mockResolvedValueOnce({ data: [165000, null] })

      const prices = await client.getMultiCurrentPrices([
        { from: 'BTC', to: 'USD' },
        { from: 'BTC', to: 'BRL' }
      ])

      expect(prices).toEqual([165000, null])
      expect(mockPost).toHaveBeenCalledTimes(1)
    })

    it('should return null when a pair cannot be resolved at all', async () => {
      mockPost
        .mockReset()
        .mockResolvedValueOnce({ data: [null] }) // BTC->XYZ not supported

      const prices = await client.getMultiCurrentPrices([{ from: 'BTC', to: 'XYZ' }])

      expect(prices).toEqual([null])
    })
  })

  describe('constructor currencyCodes option', () => {
    it('should add a translation for a symbol not in the defaults', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [DUMMY_UST_PRICE] })
      const custom = new BitfinexPricingClient({ currencyCodes: { USDT0: 'UST' } })

      await custom.getMultiCurrentPrices([{ from: 'USDT0', to: 'USD' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'UST', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should override a default translation', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [DUMMY_UST_PRICE] })
      const custom = new BitfinexPricingClient({ currencyCodes: { USDT: 'USX' } })

      await custom.getMultiCurrentPrices([{ from: 'USDT', to: 'USD' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'USX', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should match override keys and values case-insensitively', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [DUMMY_BTC_UST_PRICE] })
      const custom = new BitfinexPricingClient({ currencyCodes: { tbtc: 'btc' } })

      await custom.getMultiCurrentPrices([{ from: 'tBTC', to: 'USD' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'BTC', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should keep the default translations when overrides are given', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [DUMMY_UST_PRICE, DUMMY_WBT_PRICE] })
      const custom = new BitfinexPricingClient({ currencyCodes: { USDT0: 'UST' } })

      await custom.getMultiCurrentPrices([
        { from: 'USDT0', to: 'USD' },
        { from: 'WBTC', to: 'USD' }
      ])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [
          { ccy1: 'UST', ccy2: 'USD', amount: 1 },
          { ccy1: 'WBT', ccy2: 'USD', amount: 1 }
        ]
      }, REQUEST_HEADERS)
    })
  })

  describe('currency code resolution', () => {
    it('should resolve a symbol missing from the defaults using the published aliases', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [4.5] })

      await client.getMultiCurrentPrices([{ from: 'ATOM', to: 'USD' }])

      expect(mockConfGet).toHaveBeenCalledWith('/conf/pub:map:currency:sym')
      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'ATO', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should prefer the default over the published aliases, without reading them', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [1.0004] })

      // The aliases map USDT to USE; both sides resolve from the defaults.
      await client.getMultiCurrentPrices([{ from: 'WBTC', to: 'USDT' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'WBT', ccy2: 'UST', amount: 1 }]
      }, REQUEST_HEADERS)
      expect(mockConfGet).not.toHaveBeenCalled()
    })

    it('should prefer a constructor override over the published aliases', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [4.5] })
      const custom = new BitfinexPricingClient({ currencyCodes: { ATOM: 'ZZZ' } })

      await custom.getMultiCurrentPrices([{ from: 'ATOM', to: 'USD' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'ZZZ', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should ignore test codes when reading the aliases', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [165000] })

      await client.getMultiCurrentPrices([{ from: 'BTC', to: 'USD' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'BTC', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should ignore derivative codes when reading the aliases', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [0.5] })

      await client.getMultiCurrentPrices([{ from: 'LNX', to: 'USD' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'LNX', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should send the symbol unchanged when more than one code claims it', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [2700] })

      await client.getMultiCurrentPrices([{ from: 'XAUT', to: 'USD' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'XAUT', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should send the symbol unchanged when no code claims it', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [1.5] })

      await client.getMultiCurrentPrices([{ from: 'TON', to: 'USD' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'TON', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should read the aliases once per client, however many symbols are resolved', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [1, 2, 3] })

      await client.getMultiCurrentPrices([
        { from: 'ATOM', to: 'USD' },
        { from: 'BTC', to: 'USD' },
        { from: 'TON', to: 'USD' }
      ])
      await client.getCurrentPrice('ATOM', 'USD')

      expect(mockConfGet).toHaveBeenCalledTimes(1)
    })

    it('should send the symbol unchanged when the aliases cannot be read', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [4.5] })
      mockConfGet.mockReset().mockRejectedValue(new Error('network down'))

      await client.getMultiCurrentPrices([{ from: 'ATOM', to: 'USD' }])

      expect(mockPost).toHaveBeenCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'ATOM', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
    })

    it('should read the aliases again after a failed read', async () => {
      mockPost.mockReset().mockResolvedValue({ data: [4.5] })
      mockConfGet
        .mockReset()
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValue({ data: [DUMMY_CURRENCY_ALIASES] })
      await client.getMultiCurrentPrices([{ from: 'ATOM', to: 'USD' }])

      await client.getMultiCurrentPrices([{ from: 'ATOM', to: 'USD' }])

      expect(mockPost).toHaveBeenLastCalledWith('/calc/fx/batch', {
        pairs: [{ ccy1: 'ATO', ccy2: 'USD', amount: 1 }]
      }, REQUEST_HEADERS)
      expect(mockConfGet).toHaveBeenCalledTimes(2)
    })
  })

  describe('getHistoricalPrice', () => {
    const mockHistoricalData = [
      // Format: [SYMBOL, BID, BIDSIZE, ASK, ASKSIZE, DAILY_CHANGE, DAILY_CHANGE_RELATIVE, LAST_PRICE, VOLUME, HIGH, LOW, MTS]
      ['tBTCUSD', 163000, 1, 164000, 0, 0, 0, 0, 0, 0, 0, 0, 1709913600000],
      ['tBTCUSD', 162000, 1, 163000, 0, 0, 0, 0, 0, 0, 0, 0, 1709910000000],
      ['tBTCUSD', 161000, 1, 162000, 0, 0, 0, 0, 0, 0, 0, 0, 1709906400000]
    ]

    beforeEach(() => {
      // Override the default mock for historical data tests
      mockGet.mockReset().mockResolvedValueOnce({
        data: mockHistoricalData
      }).mockResolvedValueOnce({
        data: [] // Empty response to end pagination
      })
    })

    it('should return historical price data', async () => {
      const now = new Date().getTime()
      // 3 hours window ending now, aligned to hourly rounding behavior
      const end = now - (now % 3600000)
      const start = end - (2 * 3600000)

      // Update mock data timestamps to match start/end above
      const alignedHistoricalData = [
        ['tBTCUSD', 163000, 1, 164000, 0, 0, 0, 0, 0, 0, 0, 0, end],
        ['tBTCUSD', 162000, 1, 163000, 0, 0, 0, 0, 0, 0, 0, 0, end - 3600000],
        ['tBTCUSD', 161000, 1, 162000, 0, 0, 0, 0, 0, 0, 0, 0, start]
      ]

      mockGet.mockReset().mockResolvedValueOnce({ data: alignedHistoricalData }).mockResolvedValueOnce({ data: [] })

      const result = await client.getHistoricalPrice('BTC', 'USD', { start, end })

      expect(result).toEqual([
        { price: 164000, ts: end },
        { price: 163000, ts: end - 3600000 },
        { price: 162000, ts: start }
      ])

      expect(mockGet).toHaveBeenCalledWith(
        `/tickers/hist?symbols=tBTCUSD&limit=100&start=${start}&end=${end}`
      )
    })

    it('should throw error if start date is more than 365 days ago', async () => {
      const now = new Date().getTime()
      const tooOld = now - (366 * 24 * 60 * 60000)

      await expect(
        client.getHistoricalPrice('BTC', 'USD', { start: tooOld, end: now })
      ).rejects.toThrow('Start date should be within last 365 days')
    })

    it('should request an alias-resolved ticker', async () => {
      const now = new Date().getTime()
      const end = now - (now % 3600000)
      const start = end - (2 * 3600000)

      mockGet.mockReset().mockResolvedValueOnce({
        data: [['tATOUSD', 4, 1, 4.5, 0, 0, 0, 0, 0, 0, 0, 0, start]]
      }).mockResolvedValueOnce({ data: [] })

      await client.getHistoricalPrice('ATOM', 'USD', { start, end })

      expect(mockGet).toHaveBeenCalledWith(
        `/tickers/hist?symbols=tATOUSD&limit=100&start=${start}&end=${end}`
      )
    })

    it('should request the translated ticker for a common symbol', async () => {
      const now = new Date().getTime()
      const end = now - (now % 3600000)
      const start = end - (2 * 3600000)

      mockGet.mockReset().mockResolvedValueOnce({
        data: [['tUSTUSD', 1, 1, 1.0004, 0, 0, 0, 0, 0, 0, 0, 0, start]]
      }).mockResolvedValueOnce({ data: [] })

      await client.getHistoricalPrice('USDT', 'USD', { start, end })

      expect(mockGet).toHaveBeenCalledWith(
        `/tickers/hist?symbols=tUSTUSD&limit=100&start=${start}&end=${end}`
      )
    })

    it('should throw error if start date is zero', async () => {
      await expect(
        client.getHistoricalPrice('BTC', 'USD', { start: 0, end: new Date().getTime() })
      ).rejects.toThrow('Start date should be within last 365 days')

      expect(mockGet).not.toHaveBeenCalled()
    })

    it('should stop paging when the last row does not move back in time', async () => {
      const now = new Date().getTime()
      const end = now - (now % 3600000)
      const start = end - (24 * 3600000)

      mockGet.mockReset().mockResolvedValue({ data: [['tBTCUSD', 163000, 1, 164000, 0, 0, 0, 0, 0, 0, 0, 0, end]] })

      const result = await client.getHistoricalPrice('BTC', 'USD', { start, end })

      expect(result).toEqual([{ price: 164000, ts: end }])
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(mockGet).toHaveBeenCalledWith(`/tickers/hist?symbols=tBTCUSD&limit=100&start=${start}&end=${end}`)
    })

    it('should stop paging when the last row moves forward in time', async () => {
      const now = new Date().getTime()
      const end = now - (now % 3600000)
      const start = end - (24 * 3600000)

      mockGet.mockReset().mockResolvedValue({ data: [['tBTCUSD', 163000, 1, 164000, 0, 0, 0, 0, 0, 0, 0, 0, end + 3600000]] })

      const result = await client.getHistoricalPrice('BTC', 'USD', { start, end })

      expect(result).toEqual([{ price: 164000, ts: end + 3600000 }])
      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(mockGet).toHaveBeenCalledWith(`/tickers/hist?symbols=tBTCUSD&limit=100&start=${start}&end=${end}`)
    })

    it('should stop paging after 100 pages', async () => {
      const now = new Date().getTime()
      const end = now - (now % 3600000)
      const start = end - (24 * 3600000)

      mockGet.mockReset().mockImplementation(async (url) => {
        const cursor = Number(new URLSearchParams(url.split('?')[1]).get('end'))

        return { data: [['tBTCUSD', 163000, 1, 164000, 0, 0, 0, 0, 0, 0, 0, 0, cursor - 1]] }
      })

      const result = await client.getHistoricalPrice('BTC', 'USD', { start, end })

      expect(mockGet).toHaveBeenCalledTimes(100)
      expect(mockGet).toHaveBeenLastCalledWith(`/tickers/hist?symbols=tBTCUSD&limit=100&start=${start}&end=${end - 99}`)
      expect(result.length).toBe(100)
    })

    it('should cap results to MAX_HISTORICAL_ENTRIES', async () => {
      // Create mock data with more than MAX_HISTORICAL_ENTRIES
      const now = new Date().getTime()
      const end = now - (now % 3600000)
      const largeDataSet = Array(150).fill(null).map((_, index) => [
        'tBTCUSD',
        160000 + index,
        1,
        161000 + index,
        1,
        1000,
        0.006,
        160500 + index,
        1000,
        162000 + index,
        159000 + index,
        end - (index * 3600000)
      ])

      mockGet.mockReset().mockResolvedValueOnce({
        data: largeDataSet
      }).mockResolvedValueOnce({
        data: []
      })

      const result = await client.getHistoricalPrice('BTC', 'USD', { start: end - (150 * 3600000), end })

      expect(result.length).toBeLessThanOrEqual(client.MAX_HISTORICAL_ENTRIES)
      expect(result.length).toBe(75) // After one round of filtering (every other entry)
    })
  })

  describe('getMultiPriceData', () => {
    it('should return full price data for multiple pairs', async () => {
      mockGet.mockReset().mockResolvedValue({
        data: [
          ['tBTCUSD', 163000, 100, 164000, 100, 731.5, 0.014, 165000.5, 14480, 166000, 162000],
          ['tETHUSD', 2900, 200, 2910, 200, -50.25, -0.017, 3005.75, 50000, 3100, 2900]
        ]
      })

      const result = await client.getMultiPriceData([
        { from: 'BTC', to: 'USD' },
        { from: 'ETH', to: 'USD' }
      ])

      expect(result).toEqual([
        { lastPrice: 165000.5, dailyChange: 731.5, dailyChangeRelative: 0.014 },
        { lastPrice: 3005.75, dailyChange: -50.25, dailyChangeRelative: -0.017 }
      ])
      expect(mockGet).toHaveBeenCalledWith('/tickers?symbols=tBTCUSD,tETHUSD')
    })

    it('should return price data for a single pair', async () => {
      mockGet.mockReset().mockResolvedValue({
        data: [
          ['tBTCUSD', 163000, 100, 164000, 100, 500, 0.01, 165000, 14480, 166000, 162000]
        ]
      })

      const result = await client.getMultiPriceData([{ from: 'BTC', to: 'USD' }])

      expect(result).toEqual([
        { lastPrice: 165000, dailyChange: 500, dailyChangeRelative: 0.01 }
      ])
    })

    it('should preserve input order when API returns different order', async () => {
      mockGet.mockReset().mockResolvedValue({
        data: [
          ['tETHUSD', 2900, 200, 2910, 200, -50, -0.016, 3005, 50000, 3100, 2900],
          ['tBTCUSD', 163000, 100, 164000, 100, 1000, 0.02, 165000, 14480, 166000, 162000]
        ]
      })

      const result = await client.getMultiPriceData([
        { from: 'BTC', to: 'USD' },
        { from: 'ETH', to: 'USD' }
      ])

      expect(result[0]).toEqual({ lastPrice: 165000, dailyChange: 1000, dailyChangeRelative: 0.02 })
      expect(result[1]).toEqual({ lastPrice: 3005, dailyChange: -50, dailyChangeRelative: -0.016 })
    })

    it('should convert currency codes to uppercase', async () => {
      mockGet.mockReset().mockResolvedValue({
        data: [
          ['tBTCUSD', 163000, 100, 164000, 100, 500, 0.01, 165000, 14480, 166000, 162000]
        ]
      })

      await client.getMultiPriceData([{ from: 'btc', to: 'usd' }])

      expect(mockGet).toHaveBeenCalledWith('/tickers?symbols=tBTCUSD')
    })

    it('should use colon separator for symbols longer than 3 characters', async () => {
      mockGet.mockReset().mockResolvedValue({
        data: [
          ['tXAUT:USD', 163000, 100, 164000, 100, 15.5, 0.006, 2700.5, 500, 2750, 2650]
        ]
      })

      const result = await client.getMultiPriceData([{ from: 'XAUT', to: 'USD' }])

      expect(result).toEqual([
        { lastPrice: 2700.5, dailyChange: 15.5, dailyChangeRelative: 0.006 }
      ])
      expect(mockGet).toHaveBeenCalledWith('/tickers?symbols=tXAUT:USD')
    })

    it('should translate common symbols to Bitfinex tickers and map the response back', async () => {
      mockGet.mockReset().mockResolvedValue({
        data: [
          ['tUSTUSD', 1.0003, 100, 1.0005, 100, -0.0004, -0.0004, 1.0004, 500, 1.0009, 1.0003],
          ['tBTCUST', 83800, 1, 83900, 1, 500, 0.006, 83858, 100, 84000, 83000]
        ]
      })

      const result = await client.getMultiPriceData([
        { from: 'USDT', to: 'USD' },
        { from: 'BTC', to: 'USDT' }
      ])

      expect(result).toEqual([
        { lastPrice: 1.0004, dailyChange: -0.0004, dailyChangeRelative: -0.0004 },
        { lastPrice: 83858, dailyChange: 500, dailyChangeRelative: 0.006 }
      ])
      expect(mockGet).toHaveBeenCalledWith('/tickers?symbols=tUSTUSD,tBTCUST')
    })

    it('should build the ticker from an alias-resolved code, including the colon separator', async () => {
      mockGet.mockReset().mockResolvedValue({
        data: [['tXAUTX:USD', 10, 1, 11, 1, 0.5, 0.05, 10.5, 1, 12, 10]]
      })

      const result = await client.getMultiPriceData([{ from: 'GOLDT', to: 'USD' }])

      expect(result).toEqual([{ lastPrice: 10.5, dailyChange: 0.5, dailyChangeRelative: 0.05 }])
      expect(mockGet).toHaveBeenCalledWith('/tickers?symbols=tXAUTX:USD')
    })

    it('should apply the colon separator to the translated code, not the input symbol', async () => {
      mockGet.mockReset().mockResolvedValue({
        data: [
          ['tWHBT:USD', 83, 1, 84, 1, 0.192, 0.00228, 84.349, 1, 85, 83],
          ['tWBTUSD', 87500, 1, 87600, 1, 500, 0.006, 87539, 1, 88000, 87000]
        ]
      })

      const result = await client.getMultiPriceData([
        { from: 'WBT', to: 'USD' },
        { from: 'WBTC', to: 'USD' }
      ])

      expect(result).toEqual([
        { lastPrice: 84.349, dailyChange: 0.192, dailyChangeRelative: 0.00228 },
        { lastPrice: 87539, dailyChange: 500, dailyChangeRelative: 0.006 }
      ])
      expect(mockGet).toHaveBeenCalledWith('/tickers?symbols=tWHBT:USD,tWBTUSD')
    })

    it('should translate a symbol once, without chaining through another entry', async () => {
      mockGet.mockReset().mockResolvedValue({
        data: [['tWBTUSD', 87500, 1, 87600, 1, 500, 0.006, 87539, 1, 88000, 87000]]
      })

      const result = await client.getMultiPriceData([{ from: 'WBTC', to: 'USD' }])

      expect(result).toEqual([{ lastPrice: 87539, dailyChange: 500, dailyChangeRelative: 0.006 }])
      expect(mockGet).toHaveBeenCalledWith('/tickers?symbols=tWBTUSD')
    })

    it('should return null for a pair missing from the response', async () => {
      mockGet.mockReset().mockResolvedValue({
        data: [
          ['tBTCUSD', 163000, 100, 164000, 100, 500, 0.01, 165000, 14480, 166000, 162000]
        ]
      })

      const result = await client.getMultiPriceData([
        { from: 'BTC', to: 'USD' },
        { from: 'BTC', to: 'BRL' } // not returned by /tickers
      ])

      expect(result).toEqual([
        { lastPrice: 165000, dailyChange: 500, dailyChangeRelative: 0.01 },
        null
      ])
    })
  })
})
