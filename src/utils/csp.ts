import crypto from 'crypto';

import {
  connectSrcElements,
  defaultSrcElements,
  fontSrcElements,
  frameAncestorsElements,
  frameSrcElements,
  imgSrcElements,
  manifestSrcElements,
  objectSrcElements,
  scriptSrcElemElements,
  scriptSrcElements,
  styleSrcElemElements,
  styleSrcElements,
} from '@/constants';
import { CspElement, CspOptions, CspService } from '@/types';

export const createPolicy = (
  cspElements: CspElement[],
  servicesToInclude: CspService[] = [],
  additionalPolicies: string[] = []
) => {
  return cspElements
    .filter(({ service }) => !service || servicesToInclude.includes(service))
    .map(({ element }) => element)
    .concat(additionalPolicies)
    .join(' ');
};

export const generateCspSha256 = (scriptContent: string) => {
  // Strip out carriage returns which aren't sent by the browser, otherwise the generated hash will be different
  const scriptContentClean = scriptContent.replace(/\r/g, '');

  const hash = crypto.createHash('sha256');
  const base64 = hash.update(scriptContentClean).copy().digest('base64');
  return `'sha256-${base64}'`;
};

export const generateCsp = (
  { services: servicesToInclude = [], ...cspOptions }: CspOptions,
  ...dynamicScriptShas: (string | null | undefined)[]
) => {
  const additionalScriptSrcElements = [...(cspOptions.scriptSrcElemElements ?? []), ...dynamicScriptShas].filter(
    Boolean
  ) as string[];

  const policies = [
    createPolicy(defaultSrcElements),
    createPolicy(scriptSrcElemElements, servicesToInclude, additionalScriptSrcElements),
    createPolicy(scriptSrcElements, servicesToInclude, cspOptions.scriptSrcElements),
    createPolicy(styleSrcElements, servicesToInclude, cspOptions.styleSrcElements),
    createPolicy(styleSrcElemElements, servicesToInclude, cspOptions.styleSrcElemElements),
    createPolicy(fontSrcElements, servicesToInclude, cspOptions.fontSrcElements),
    createPolicy(imgSrcElements, servicesToInclude, cspOptions.imgSrcElements),
    createPolicy(manifestSrcElements, servicesToInclude, cspOptions.manifestSrcElements),
    createPolicy(connectSrcElements, servicesToInclude, cspOptions.connectSrcElements),
    createPolicy(frameSrcElements, servicesToInclude, cspOptions.frameSrcElements),
    createPolicy(frameAncestorsElements, servicesToInclude, cspOptions.frameAncestorsElements),
    createPolicy(objectSrcElements, servicesToInclude, cspOptions.objectSrcElements),
  ];

  return policies.join('; ');
};
