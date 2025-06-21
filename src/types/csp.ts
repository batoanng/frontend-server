export type CspOptions = {
  /** Well known CSP services that are required to be put into csp headers */
  services?: CspService[];
  /** Extends the base script-src-elem policy */
  scriptSrcElemElements?: string[];
  /** Extends the base script-src policy */
  scriptSrcElements?: string[];
  /** Extends the base style-src policy */
  styleSrcElements?: string[];
  /** Extends the base style-src-elem policy */
  styleSrcElemElements?: string[];
  /** Extends the base font-src policy */
  fontSrcElements?: string[];
  /** Extends the base img-src policy */
  imgSrcElements?: string[];
  /** Extends the base manifest-src policy */
  manifestSrcElements?: string[];
  /** Extends the base connect-src policy */
  connectSrcElements?: string[];
  /** Extends the base frame-src policy */
  frameSrcElements?: string[];
  /** Extends the base frame-ancestors policy */
  frameAncestorsElements?: string[];
  /** Extends the base object-src policy */
  objectSrcElements?: string[];
};

export type CspElement = {
  element: string;
  service?: CspService;
};

/** The list of well known CSP services that can be added across CSP directives by their service name */
export type CspService =
  | 'full-story'
  | 'google-analytics'
  | 'google-fonts'
  | 'google-translate'
  | 'hotjar'
  | 'newrelic'
  | 'power-bi'
  | 'snsw'
  | 'snsw-fonts'
  | 'tutd';
