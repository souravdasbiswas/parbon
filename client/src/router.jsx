/* eslint-disable react-refresh/only-export-components -- route table: lazy page components live alongside the router config */
import { Suspense, lazy } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import Layout from './components/layout/Layout.jsx';
import Button from './components/ui/Button.jsx';

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin.jsx'));
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements.jsx'));
const AdminAnnouncementForm = lazy(() => import('./pages/admin/AdminAnnouncementForm.jsx'));
const AdminResponses = lazy(() => import('./pages/admin/AdminResponses.jsx'));
const AdminStorage = lazy(() => import('./pages/admin/AdminStorage.jsx'));
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents.jsx'));
const AdminEventForm = lazy(() => import('./pages/admin/AdminEventForm.jsx'));
const AdminCouponEvents = lazy(() => import('./pages/admin/coupons/AdminCouponEvents.jsx'));
const AdminCouponEvent = lazy(() => import('./pages/admin/coupons/AdminCouponEvent.jsx'));
const AdminCouponDesigner = lazy(() => import('./pages/admin/coupons/AdminCouponDesigner.jsx'));
const AdminGateTeam = lazy(() => import('./pages/admin/coupons/AdminGateTeam.jsx'));
const Scanner = lazy(() => import('./pages/scan/Scanner.jsx'));

function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : 'An unexpected error occurred.';
  return (
    <div className="container section" role="alert" style={{ textAlign: 'center', display: 'grid', gap: '1rem', justifyItems: 'center' }}>
      <p lang="bn" className="bn-display" style={{ fontSize: '2rem', color: 'var(--color-vermilion)' }}>
        দুঃখিত!
      </p>
      <p>{message}</p>
      <Button href="/">Back to home</Button>
    </div>
  );
}

const adminRouteTree = {
  path: '/',
  Component: Layout,
  errorElement: <RouteError />,
  children: [
    { path: 'admin', Component: AdminLogin },
    { path: 'admin/announcements', Component: AdminAnnouncements },
    { path: 'admin/announcements/new', Component: AdminAnnouncementForm },
    { path: 'admin/announcements/:id', Component: AdminAnnouncementForm },
    { path: 'admin/responses', Component: AdminResponses },
    { path: 'admin/storage', Component: AdminStorage },
    { path: 'admin/events', Component: AdminEvents },
    { path: 'admin/events/new', Component: AdminEventForm },
    { path: 'admin/events/:id', Component: AdminEventForm },
    { path: 'admin/coupons', Component: AdminCouponEvents },
    { path: 'admin/coupons/gate-team', Component: AdminGateTeam },
    { path: 'admin/coupons/:id', Component: AdminCouponEvent },
    { path: 'admin/coupons/:eventId/types/:typeId/design', Component: AdminCouponDesigner },
  ],
};

const scanRoute = {
  path: '/scan',
  errorElement: <RouteError />,
  element: (
    <Suspense fallback={null}>
      <Scanner />
    </Suspense>
  ),
};

export function composeRoutes(versionRouteTree) {
  return [adminRouteTree, scanRoute, versionRouteTree];
}

export { RouteError };
