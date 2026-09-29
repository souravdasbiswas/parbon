import { useEffect, useState } from 'react';
import { couponsApi } from '../../services/api.js';
import Button from '../ui/Button.jsx';

/** "Get your coupons" for a website event that has an open coupon registration linked to it. */
export default function CouponsCta({ siteEventSlug, className }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let active = true;
    couponsApi.openEvents(siteEventSlug).then(
      (list) => active && setEvents(list || []),
      () => {},
    );
    return () => {
      active = false;
    };
  }, [siteEventSlug]);

  if (!events.length) return null;
  return (
    <div className={className}>
      {events.map((e) => (
        <Button key={e.slug} to={`/register/${e.slug}`} arrow>
          {events.length > 1 ? `Get coupons — ${e.title.en}` : 'Get your coupons'}
        </Button>
      ))}
    </div>
  );
}
