/* eslint-disable react-refresh/only-export-components -- route table: lazy page components live alongside redirect helpers */
import { lazy } from 'react';
import { Navigate, useParams } from 'react-router';
import Layout from '../../components/layout/Layout.jsx';
import Home from '../../pages/Home.jsx';
import { RouteError } from '../../router.jsx';

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

function SponsorRedirect() {
  const { slug } = useParams();
  return <Navigate to={slug ? `/events/${slug}` : '/get-involved'} replace />;
}

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
  { path: 'give', element: <Navigate to="/get-involved#donate" replace /> },
  { path: 'passes', element: <Navigate to="/register" replace /> },
  { path: 'sponsor', Component: SponsorRedirect },
  { path: 'sponsor/:slug', Component: SponsorRedirect },
  { path: '*', Component: NotFound },
];

export const routes = {
  path: '/',
  Component: Layout,
  errorElement: <RouteError />,
  children: publicRoutes,
};

export default routes;
