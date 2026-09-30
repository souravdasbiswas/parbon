import { Navigate, useParams } from 'react-router';

export default function SponsorRedirect() {
  const { slug } = useParams();
  return <Navigate replace to={slug ? `/events/${slug}?sponsor=1` : '/?sponsor=1'} />;
}
