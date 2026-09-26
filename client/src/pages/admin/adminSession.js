import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { adminApi } from '../../services/api.js';

/**
 * Admin session state. With `require: true`, unauthenticated visitors are sent to /admin.
 * The session itself is an HttpOnly cookie — JavaScript never sees the token.
 */
export function useAdminSession({ require = false } = {}) {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', user: null });

  const refresh = useCallback(async () => {
    try {
      const user = await adminApi.me();
      setState({ status: 'authed', user });
    } catch {
      setState({ status: 'anon', user: null });
    }
  }, []);

  useEffect(() => {
    let active = true;
    adminApi
      .me()
      .then((user) => active && setState({ status: 'authed', user }))
      .catch(() => active && setState({ status: 'anon', user: null }));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (require && state.status === 'anon') navigate('/admin', { replace: true });
  }, [require, state.status, navigate]);

  const signOut = useCallback(async () => {
    await adminApi.logout().catch(() => {});
    setState({ status: 'anon', user: null });
    navigate('/admin', { replace: true });
  }, [navigate]);

  return { ...state, refresh, signOut };
}

/**
 * Resizes an image in the browser (max 1600px wide) and re-encodes it as JPEG.
 * Keeps uploads small and strips EXIF metadata such as GPS location.
 */
export async function prepareImage(file, maxWidth = 1600) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Please choose a JPEG, PNG or WebP image.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffdf9'; // transparent PNGs get the site's paper colour instead of black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.86), width, height };
}
