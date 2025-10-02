export class BitfinexPricingClient extends PricingClient {
    HISTORICAL_DATA_AGE: number;
    MAX_HISTORICAL_ENTRIES: number;
    client: import("axios").AxiosInstance;
    /**
     * Returns the recorded lowest ask (not trade) of the asset pair.
     * Bitfinex only supports max 250 records per request.
     * @async
     * @param {HistoricalPriceOptions} opts
     * @returns {Promise<HistoricalPriceResult[]>}
     */
    getHistoricalPrice(opts: HistoricalPriceOptions): Promise<HistoricalPriceResult[]>;
    /**
     * Cuts the results to the maximum number of entries.
     * @param {HistoricalPriceResult[]} results
     * @returns {HistoricalPriceResult[]}
     */
    _cappedToMaxResults(results: HistoricalPriceResult[]): HistoricalPriceResult[];
}
import { PricingClient } from 'wdk-pricing-provider';
