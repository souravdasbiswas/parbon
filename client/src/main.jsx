import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';

// Self-hosted fonts (bundled by Vite; unicode-range subsets load only what a page needs).
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/tiro-bangla/400.css';
import '@fontsource-variable/source-sans-3/wght.css';
import '@fontsource-variable/noto-sans-bengali/wght.css';

import './styles/tokens.css';
import './styles/base.css';

import { LocaleProvider } from './i18n/LocaleContext.jsx';
import { composeRoutes } from './router.jsx';
import PreviewBadge from './ui/PreviewBadge.jsx';
import { getUiVersion, loadUiRoutes } from './ui/versions.js';

const root = createRoot(document.getElementById('root'));
const version = getUiVersion();
document.documentElement.dataset.ui = version;

function render(router) {
  root.render(
    <StrictMode>
      <LocaleProvider>
        <RouterProvider router={router} />
        <PreviewBadge />
      </LocaleProvider>
    </StrictMode>,
  );
}

loadUiRoutes(version)
  .then((module) => {
    const versionRouteTree = module.routes || module.default;
    render(createBrowserRouter(composeRoutes(versionRouteTree)));
  })
  .catch((error) => {
    console.error('[parbon] Unable to load UI routes.', error);
    root.render(
      <StrictMode>
        <div className="container section" role="alert">
          <h1>Parbon could not load</h1>
          <p>Please refresh the page. If the problem continues, contact the organisers.</p>
        </div>
      </StrictMode>,
    );
  });
