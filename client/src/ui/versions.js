export const uiVersions = {
  v1: () => import('./v1/routes.jsx'),
  v2: () => import('./v2/routes.jsx'),
};

export function getUiVersion() {
  const version = document.querySelector('meta[name="parbon-ui"]')?.getAttribute('content') || 'v1';
  return uiVersions[version] ? version : 'v1';
}

export function loadUiRoutes(version = getUiVersion()) {
  return (uiVersions[version] || uiVersions.v1)();
}
