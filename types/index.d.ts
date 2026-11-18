export class BitfinexPricingClient extends PricingClient {
    /**
     * Creates a Bitfinex pricing client.
     *
     * @param {BitfinexPricingClientOptions} [options] - Currency-code overrides applied over the built-in defaults (default: none).
     */
    constructor(options?: BitfinexPricingClientOptions);
    /** @private */
    private HISTORICAL_DATA_AGE;
    /** @private */
    private MAX_HISTORICAL_ENTRIES;
    /** @private */
    private MAX_HISTORICAL_PAGES;
    /** @private */
    private client;
    /** @private */
    private _currencyCodes;
    /** @private */
    private _apiCodesPromise;
    /** @private */
    private _apiCurrencyCodes;
    /** @private */
    private _currencyCode;
    /** @private */
    private _fxBatch;
    /**
     * Builds a Bitfinex ticker symbol for a currency pair.
     * Bitfinex requires a colon separator when either symbol is longer than 3 characters
     * (e.g. tXAUT:USD instead of tXAUTUSD).
     * @private
     * @param {string} from - Base currency (e.g. 'BTC', 'XAUT')
     * @param {string} to - Quote currency (e.g. 'USD')
     * @returns {Promise<string>} Bitfinex ticker symbol (e.g. 'tBTCUSD', 'tXAUT:USD', 'tUSTUSD' for USDT)
     */
    private _tickerFor;
    /**
     * @private
     * @param {HistoricalPriceResult[]} results
     * @returns {HistoricalPriceResult[]}
     */
    private _cappedToMaxResults;
}
export type PricePair = import("@tetherto/wdk-pricing-provider").PricePair;
export type HistoricalPriceOptions = import("@tetherto/wdk-pricing-provider").HistoricalPriceOptions;
export type HistoricalPriceResult = import("@tetherto/wdk-pricing-provider").HistoricalPriceResult;
export type PriceData = import("@tetherto/wdk-pricing-provider").PriceData;
/**
 * The options accepted by `BitfinexPricingClient`.
 */
export type BitfinexPricingClientOptions = {
    /**
     * - Common-symbol-to-Bitfinex-currency-code
     * overrides, merged over the built-in defaults (e.g. `{ USDT0: 'UST' }`). Keys and
     * values are upper-cased.
     */
    currencyCodes?: Record<string, string>;
};
import { PricingClient } from '@tetherto/wdk-pricing-provider';
