/**
 * @typedef {Object} CurrencyPair
 * @property {string} from Base currency (e.g. 'BTC')
 * @property {string} to Quote currency (e.g. 'USD')
 */
/**
 * @typedef {Object} HistoricalPriceOptions
 * @property {string} from Base currency (e.g. 'BTC')
 * @property {string} to Quote currency (e.g. 'USD')
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
    HISTORICAL_DATA_AGE: number;
    /** @internal */
    MAX_HISTORICAL_ENTRIES: number;
    /** @internal */
    client: import("axios").AxiosInstance;
    /**
     * @param {CurrencyPair[]} pairs - Array of currency pairs
     * @returns {Promise<number[]>} Array of prices in the same order as input pairs
     */
    getMultiCurrentPrice(pairs: CurrencyPair[]): Promise<number[]>;
    /**
     * @param {string} from - Base currency (e.g. 'BTC')
     * @param {string} to - Quote currency (e.g. 'USD')
     * @param {HistoricalPriceOptions} [opts={}] - Optional time range
     * @returns {Promise<HistoricalPriceResult[]>}
     */
    getHistoricalPrice(from: string, to: string, opts?: HistoricalPriceOptions): Promise<HistoricalPriceResult[]>;
    /**
     * @internal
     * @param {HistoricalPriceResult[]} results
     * @returns {HistoricalPriceResult[]}
     */
    _cappedToMaxResults(results: HistoricalPriceResult[]): HistoricalPriceResult[];
}
export type CurrencyPair = {
    /**
     * Base currency (e.g. 'BTC')
     */
    from: string;
    /**
     * Quote currency (e.g. 'USD')
     */
    to: string;
};
export type HistoricalPriceOptions = {
    /**
     * Base currency (e.g. 'BTC')
     */
    from: string;
    /**
     * Quote currency (e.g. 'USD')
     */
    to: string;
    /**
     * Start of the time range as a Unix timestamp in milliseconds
     */
    start: number;
    /**
     * End of the time range as a Unix timestamp in milliseconds
     */
    end: number;
};
export type HistoricalPriceResult = {
    /**
     * Asset price at the given timestamp
     */
    price: number;
    /**
     * Unix timestamp in milliseconds
     */
    timestamp: number;
};
import { PricingClient } from "@tetherto/wdk-pricing-provider";
