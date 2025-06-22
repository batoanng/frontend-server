export interface NewRelicConfig {
  applicationId: string;
  agentId?: string;
  accountId: string;
  trustKey: string;
  licenceKey: string;
}

export type BuildServerNewRelicConfig = Pick<NewRelicConfig, 'applicationId'> &
  Partial<Omit<NewRelicConfig, 'applicationId'>>;
