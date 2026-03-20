export class BitfinexPricingClient extends PricingClient {
    /** @internal */
    HISTORICAL_DATA_AGE: number;
    /** @internal */
    MAX_HISTORICAL_ENTRIES: number;
    /** @internal */
    client: import("axios").AxiosInstance;
    /**
     * @internal
     * @param {HistoricalPriceResult[]} results
     * @returns {HistoricalPriceResult[]}
     */
    _cappedToMaxResults(results: HistoricalPriceResult[]): HistoricalPriceResult[];
}
export type PricePair = import("@tetherto/wdk-pricing-provider").PricePair;
export type HistoricalPriceOptions = import("@tetherto/wdk-pricing-provider").HistoricalPriceOptions;
export type HistoricalPriceResult = import("@tetherto/wdk-pricing-provider").HistoricalPriceResult;
export type PriceData = import("@tetherto/wdk-pricing-provider").PriceData;
import { PricingClient } from '@tetherto/wdk-pricing-provider';
