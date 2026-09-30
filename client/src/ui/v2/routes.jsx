/* eslint-disable react-refresh/only-export-components -- route table: lazy page components live alongside small placeholder elements */
import { lazy } from 'react';
import { RouteError } from '../../router.jsx';
import GivePage from './GivePage.jsx';
import SponsorRedirect from './SponsorRedirect.jsx';
import V2ComingSoon from './V2ComingSoon.jsx';
import V2Layout from './V2Layout.jsx';
import DurgaPujaHub from './hub/DurgaPujaHub.jsx';
import EventHub from './hub/EventHub.jsx';
import V2Home from './hub/V2Home.jsx';

// Home is eagerly loaded (it is the LCP page); every other public page is code-split.
const About = lazy(() => import('../../pages/About.jsx'));
const Events = lazy(() => import('../../pages/Events.jsx'));
const Gallery = lazy(() => import('../../pages/Gallery.jsx'));
const GetInvolved = lazy(() => import('../../pages/GetInvolved.jsx'));
const Contact = lazy(() => import('../../pages/Contact.jsx'));
const Announcements = lazy(() => import('../../pages/Announcements.jsx'));
const AnnouncementDetail = lazy(() => import('../../pages/AnnouncementDetail.jsx'));
const Register = lazy(() => import('../../pages/coupons/Register.jsx'));
const CouponView = lazy(() => import('../../pages/coupons/CouponView.jsx'));
const NotFound = lazy(() => import('../../pages/NotFound.jsx'));

export const publicRoutes = [
  { index: true, Component: V2Home },
  { path: 'about', Component: About },
  { path: 'durga-puja', Component: DurgaPujaHub },
  { path: 'events', Component: Events },
  { path: 'events/:slug', Component: EventHub },
  { path: 'gallery', Component: Gallery },
  { path: 'get-involved', Component: GetInvolved },
  { path: 'contact', Component: Contact },
  { path: 'announcements', Component: Announcements },
  { path: 'announcements/:slug', Component: AnnouncementDetail },
  { path: 'register', Component: Register },
  { path: 'register/:slug', Component: Register },
  { path: 'c/:token', Component: CouponView },
  { path: 'give', Component: GivePage },
  { path: 'passes', element: <V2ComingSoon kind="passes" /> },
  { path: 'sponsor', Component: SponsorRedirect },
  { path: 'sponsor/:slug', Component: SponsorRedirect },
  { path: '*', Component: NotFound },
];

export const routes = {
  path: '/',
  Component: V2Layout,
  errorElement: <RouteError />,
  children: publicRoutes,
};

export default routes;
