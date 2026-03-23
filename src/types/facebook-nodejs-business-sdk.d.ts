declare module 'facebook-nodejs-business-sdk' {
  export class FacebookAdsApi {
    static init(accessToken: string): FacebookAdsApi;
  }
  export class AdAccount {
    constructor(id: string);
    getInsights(
      fields: string[],
      params: Record<string, unknown>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<Array<{ _data: Record<string, any> }>>;
    getCampaigns(
      fields: string[],
      params: Record<string, unknown>,
    ): Promise<
      Array<{
        id: string;
        name: string;
        getInsights(
          fields: string[],
          params: Record<string, unknown>,
        ): Promise<Array<Record<string, string>>>;
      }>
    >;
  }
  const _default: {
    FacebookAdsApi: typeof FacebookAdsApi;
    AdAccount: typeof AdAccount;
  };
  export default _default;
}
