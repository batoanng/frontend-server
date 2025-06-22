export const generateClientEnvScript = (globalVariableName: string, envVariables: Record<string, string>) => {
  const variableNameParts = globalVariableName.split('.').reverse();

  // If this is a one-part variable name then assign it directly to window, e.g. 'window.globalVars = {...}'
  if (variableNameParts.length === 1) {
    return `window["${variableNameParts[0]}"]=${JSON.stringify(envVariables)};`;
  }

  // Otherwise we need to nest the variables, e.g. `window.process = { env: {...} };`
  const [variableName, ...rest] = globalVariableName.split('.').reverse();

  let clientEnvScript = `{"${variableName}":${JSON.stringify(envVariables)}}`;

  for (let i = 0; i < rest.length; i++) {
    const variablePart = rest[i];

    if (i === rest.length - 1) {
      clientEnvScript = `window["${variablePart}"]=${clientEnvScript};`;
    } else {
      clientEnvScript = `{"${variablePart}":${clientEnvScript}}`;
    }
  }

  return clientEnvScript;
};
