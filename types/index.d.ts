import { PricingClient, PriceData } from "@tetherto/wdk-pricing-provider";

/** A currency pair used to identify a trading market. */
export type CurrencyPair = {
  /** Base currency (e.g. 'BTC') */
  from: string;
  /** Quote currency (e.g. 'USD') */
  to: string;
};

/** Optional time range for fetching historical price data. */
export type HistoricalPriceOptions = {
  /** Start of the time range as a Unix timestamp in milliseconds */
  start?: number;
  /** End of the time range as a Unix timestamp in milliseconds */
  end?: number;
};

/** A single historical price entry. */
export type HistoricalPriceResult = {
  /** Asset price at the given timestamp */
  price: number;
  /** Unix timestamp in milliseconds */
  ts: number;
};

export class BitfinexPricingClient extends PricingClient {
  /**
   * Fetches the current price for a single currency pair.
   * @param from Base currency (e.g. 'BTC')
   * @param to Quote currency (e.g. 'USD')
   */
  getCurrentPrice(from: string, to: string): Promise<number>;

  /**
   * Fetches current prices for multiple currency pairs in a single request.
   * Returns prices in the same order as the input pairs.
   */
  getMultiCurrentPrice(pairs: CurrencyPair[]): Promise<number[]>;

  /**
   * Fetches full price data (last price, daily change, relative daily change)
   * for multiple currency pairs in a single batch request.
   * Returns price data in the same order as the input pairs.
   */
  getMultiPriceData(pairs: CurrencyPair[]): Promise<PriceData[]>;

  /**
   * Fetches historical prices for a currency pair.
   * Maximum look-back window is 365 days. Results are capped at 100 entries.
   * @param from Base currency (e.g. 'BTC')
   * @param to Quote currency (e.g. 'USD')
   * @param opts Optional time range (start/end as Unix timestamps in milliseconds)
   */
  getHistoricalPrice(from: string, to: string, opts?: HistoricalPriceOptions): Promise<HistoricalPriceResult[]>;
}
