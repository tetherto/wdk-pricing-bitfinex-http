export class BitfinexPricingClient extends PricingClient {
    HISTORICAL_DATA_AGE: number;
    MAX_HISTORICAL_ENTRIES: number;
    client: import("axios").AxiosInstance;

    getCurrentPrice(from: string, to: string): Promise<number>;
    getMultiCurrentPrice(pairs: { from: string, to: string }[]): Promise<number[]>;
    getHistoricalPrice(opts: HistoricalPriceOptions): Promise<HistoricalPriceResult[]>;
    _cappedToMaxResults(results: HistoricalPriceResult[]): HistoricalPriceResult[];
}
import { PricingClient } from 'wdk-pricing-provider';
