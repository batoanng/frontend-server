export const createAppPathFactory = (appPrefix = '') => {
  return (path: string) => `/${appPrefix}/${path}`.replace(/\/{2,}/g, '/');
};
