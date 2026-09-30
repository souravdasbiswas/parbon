/* eslint-disable react-refresh/only-export-components -- route table: lazy page components live alongside small placeholder elements */
import { lazy } from 'react';
import Home from '../../pages/Home.jsx';
import { RouteError } from '../../router.jsx';
import V2ComingSoon from './V2ComingSoon.jsx';
import V2Layout from './V2Layout.jsx';

// Home is eagerly loaded (it is the LCP page); every other public page is code-split.
const About = lazy(() => import('../../pages/About.jsx'));
const DurgaPuja = lazy(() => import('../../pages/DurgaPuja.jsx'));
const Events = lazy(() => import('../../pages/Events.jsx'));
const EventDetail = lazy(() => import('../../pages/EventDetail.jsx'));
const Gallery = lazy(() => import('../../pages/Gallery.jsx'));
const GetInvolved = lazy(() => import('../../pages/GetInvolved.jsx'));
const Contact = lazy(() => import('../../pages/Contact.jsx'));
const Announcements = lazy(() => import('../../pages/Announcements.jsx'));
const AnnouncementDetail = lazy(() => import('../../pages/AnnouncementDetail.jsx'));
const Register = lazy(() => import('../../pages/coupons/Register.jsx'));
const CouponView = lazy(() => import('../../pages/coupons/CouponView.jsx'));
const NotFound = lazy(() => import('../../pages/NotFound.jsx'));

export const publicRoutes = [
  { index: true, Component: Home },
  { path: 'about', Component: About },
  { path: 'durga-puja', Component: DurgaPuja },
  { path: 'events', Component: Events },
  { path: 'events/:slug', Component: EventDetail },
  { path: 'gallery', Component: Gallery },
  { path: 'get-involved', Component: GetInvolved },
  { path: 'contact', Component: Contact },
  { path: 'announcements', Component: Announcements },
  { path: 'announcements/:slug', Component: AnnouncementDetail },
  { path: 'register', Component: Register },
  { path: 'register/:slug', Component: Register },
  { path: 'c/:token', Component: CouponView },
  { path: 'give', element: <V2ComingSoon kind="give" /> },
  { path: 'passes', element: <V2ComingSoon kind="passes" /> },
  { path: 'sponsor', element: <V2ComingSoon kind="sponsor" /> },
  { path: 'sponsor/:slug', element: <V2ComingSoon kind="sponsor" /> },
  { path: '*', Component: NotFound },
];

export const routes = {
  path: '/',
  Component: V2Layout,
  errorElement: <RouteError />,
  children: publicRoutes,
};

export default routes;
