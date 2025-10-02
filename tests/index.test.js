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

describe('BitfinexPricingClient', () => {
  let client
  let mockGet

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
    // Create a mock post function for current price
    const mockPost = jest.fn().mockResolvedValue({
      data: [165000.12345]
    })

    // Mock axios.create to return an object with our mock get function for historical data
    axios.create = jest.fn().mockReturnValue({
      get: mockGet,
      post: mockPost
    })

    client = new BitfinexPricingClient()
  })

  describe('getCurrentPrice', () => {
    it('should return the current price from Bitfinex API', async () => {
      const price = await client.getCurrentPrice('BTC', 'USD')

      expect(price).toBe(165000.12345)
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api-pub.bitfinex.com/v2'
      })
      // Get the post function from the mocked axios client
      const mockPost = axios.create().post
      expect(mockPost).toHaveBeenCalledWith('/calc/fx', {
        ccy1: 'BTC',
        ccy2: 'USD'
      }, {
        headers: {
          contentType: 'application/json',
          accept: 'application/json'
        }
      })
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

      const result = await client.getHistoricalPrice({
        from: 'BTC',
        to: 'USD',
        start,
        end
      })

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
        client.getHistoricalPrice({
          from: 'BTC',
          to: 'USD',
          start: tooOld,
          end: now
        })
      ).rejects.toThrow('Start date should be within last 365 days')
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

      const result = await client.getHistoricalPrice({
        from: 'BTC',
        to: 'USD',
        start: end - (150 * 3600000),
        end
      })

      expect(result.length).toBeLessThanOrEqual(client.MAX_HISTORICAL_ENTRIES)
      expect(result.length).toBe(75) // After one round of filtering (every other entry)
    })
  })
})
