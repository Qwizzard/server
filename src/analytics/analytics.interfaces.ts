/**
 * Properties that can be sent with analytics events
 */
export interface AnalyticsEventProperties {
  [key: string]:
    | string
    | number
    | boolean
    | undefined
    | Record<string, unknown>
    | Array<unknown>;
}

/**
 * Group identifiers for associating events with organizations or teams
 */
export interface AnalyticsGroup {
  [key: string]: string;
}
