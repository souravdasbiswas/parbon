import { useEffect } from 'react';
import { useParams } from 'react-router';
import CouponView from '../../../pages/coupons/CouponView.jsx';
import { couponsApi } from '../../../services/api.js';
import { addPass } from '../passStore.js';

export default function CouponCapturePage() {
  const { token } = useParams();

  useEffect(() => {
    let active = true;
    if (!token) return undefined;
    couponsApi.coupon(token).then(
      (coupon) => {
        if (active) addPass(coupon);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [token]);

  return <CouponView />;
}
