import test from 'brittle'

import { BitfinexPricingClient } from '../bare.js'

test('bare runtime: exports pricing client', t => {
  t.ok(BitfinexPricingClient, 'BitfinexPricingClient should be exported')
  const client = new BitfinexPricingClient()
  t.ok(client, 'instance should be constructible')
  t.ok(typeof client.getCurrentPrice === 'function', 'getCurrentPrice should exist')
  t.ok(typeof client.getHistoricalPrice === 'function', 'getHistoricalPrice should exist')
})
