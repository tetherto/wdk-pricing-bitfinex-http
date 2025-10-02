'use strict'

import { describe, expect, it, jest, beforeAll } from '@jest/globals'
import { BitfinexPricingClient } from '../../index.js'

describe('Integration: BitfinexPricingClient (real API)', () => {
  beforeAll(() => {
    jest.setTimeout(20000)
  })

  it('fetches current price from Bitfinex API without mocks', async () => {
    const client = new BitfinexPricingClient()

    const price = await client.getCurrentPrice('BTC', 'USD')

    expect(typeof price).toBe('number')
    expect(price).toBeGreaterThan(0)
  })
})



