import { CspElement } from '@server/types';

export const defaultSrcElements: CspElement[] = [{ element: 'default-src' }, { element: "'self'" }];

export const scriptSrcElemElements: CspElement[] = [
  { element: 'script-src-elem' },
  { element: "'self'" },
  { element: 'https://translate.google.com', service: 'google-translate' },
  { element: 'https://translate.googleapis.com', service: 'google-translate' },
  { element: 'https://translate-pa.googleapis.com', service: 'google-translate' },
  { element: 'https://www.googletagmanager.com', service: 'google-analytics' },
  { element: 'https://static.hotjar.com', service: 'hotjar' },
  { element: 'https://script.hotjar.com', service: 'hotjar' },
  { element: 'https://js-agent.newrelic.com', service: 'newrelic' },
  { element: 'https://bam.nr-data.net', service: 'newrelic' },
];

export const scriptSrcElements: CspElement[] = [
  { element: 'script-src' },
  { element: "'self'" },
  { element: 'http://*.hotjar.com:*', service: 'hotjar' },
  { element: 'https://*.hotjar.com:*', service: 'hotjar' },
  { element: 'http://*.hotjar.io', service: 'hotjar' },
  { element: 'https://*.hotjar.io', service: 'hotjar' },
  { element: 'wss://*.hotjar.com', service: 'hotjar' },
  { element: 'https://stats.g.doubleclick.net', service: 'google-analytics' },
  { element: 'https://*.fullstory.com', service: 'full-story' },
  { element: 'https://fonts.google.com', service: 'google-fonts' },
  { element: 'https://www.googletagmanager.com', service: 'google-analytics' },
  { element: 'https://*.google-analytics.com', service: 'google-analytics' },
  { element: 'https://bam.nr-data.net', service: 'newrelic' },
  { element: 'https://js-agent.newrelic.com', service: 'newrelic' },
];

export const styleSrcElements: CspElement[] = [{ element: 'style-src' }, { element: "'self'" }];

export const styleSrcElemElements: CspElement[] = [
  { element: 'style-src-elem' },
  { element: "'self'" },
  { element: "'unsafe-inline'" },
  { element: 'https://cloud.typography.com' },
  { element: 'https://fonts.googleapis.com', service: 'google-fonts' },
  { element: 'https://translate.googleapis.com', service: 'google-translate' },
];

export const fontSrcElements: CspElement[] = [
  { element: 'font-src' },
  { element: "'self'" },
  { element: 'https://fonts.gstatic.com', service: 'google-fonts' },
];

export const imgSrcElements: CspElement[] = [
  { element: 'img-src' },
  { element: "'self'" },
  { element: 'data:' },
  { element: 'https://www.google-analytics.com', service: 'google-analytics' },
  { element: 'https://translate.googleapis.com', service: 'google-translate' },
  { element: 'https://translate.google.com', service: 'google-translate' },
];

export const manifestSrcElements: CspElement[] = [
  { element: 'manifest-src' },
  { element: "'self'" },
  { element: 'data:' },
];

export const connectSrcElements: CspElement[] = [
  { element: 'connect-src' },
  { element: "'self'" },
  { element: 'https://translate.googleapis.com', service: 'google-translate' },
  { element: 'https://translation.googleapis.com', service: 'google-translate' },
  { element: 'https://www.google-analytics.com', service: 'google-analytics' },
  { element: 'https://bam.nr-data.net', service: 'newrelic' },
  { element: 'https://*.hotjar.com', service: 'hotjar' },
  { element: 'https://*.hotjar.io', service: 'hotjar' },
  { element: 'wss://*.hotjar.com', service: 'hotjar' },
  { element: 'https://api.powerbi.com', service: 'power-bi' },
];

export const frameSrcElements: CspElement[] = [
  { element: 'frame-src' },
  { element: "'self'" },
  { element: 'https://vars.hotjar.com', service: 'hotjar' },
];

export const frameAncestorsElements: CspElement[] = [{ element: 'frame-ancestors' }, { element: "'none'" }];

export const objectSrcElements: CspElement[] = [{ element: 'object-src' }, { element: "'none'" }];

export const cspApiElements = [
  `default-src 'none'`,
  `script-src 'self'`,
  `style-src 'self'`,
  `object-src 'none'`,
  `img-src 'self'`,
  `font-src 'self'`,
  `frame-ancestors 'none'`,
  'block-all-mixed-content',
];
