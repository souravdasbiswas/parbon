import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

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
import { router } from './router.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LocaleProvider>
      <RouterProvider router={router} />
    </LocaleProvider>
  </StrictMode>,
);
