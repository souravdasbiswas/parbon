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

/**
 * Prepares a sponsor logo: on a light background (or transparent) the paper tone is lifted to pure
 * white and empty margins are trimmed, so a photo or screenshot of a logo still looks clean. Logos on
 * their own coloured ground are left as they are. Output is at most 320px tall (sharp on retina screens).
 */
export async function prepareLogo(file, { maxHeight = 320, maxWidth = 960 } = {}) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Please choose a JPEG, PNG or WebP image.');
  const bitmap = await createImageBitmap(file);
  const src = Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.fillStyle = '#fff';
  sctx.fillRect(0, 0, src.width, src.height);
  sctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const { width: w, height: h } = src;
  const img = sctx.getImageData(0, 0, w, h);
  const px = img.data;
  const at = (x, y) => (y * w + x) * 4;
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const paper = [0, 1, 2].map((c) => Math.max(...corners.map((i) => px[i + c])));
  let box = { x: 0, y: 0, w, h };

  if (paper.every((v) => v >= 215)) {
    // Scale each channel so the paper becomes white; inks are barely touched.
    const gain = paper.map((v) => 255 / Math.max(v - 6, 1));
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = at(x, y);
        for (let c = 0; c < 3; c++) px[i + c] = Math.min(255, px[i + c] * gain[c]);
        if (px[i] + px[i + 1] + px[i + 2] < 735) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    sctx.putImageData(img, 0, 0);
    if (maxX >= minX) {
      const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
      const x = Math.max(0, minX - pad);
      const y = Math.max(0, minY - pad);
      box = { x, y, w: Math.min(w, maxX + pad + 1) - x, h: Math.min(h, maxY + pad + 1) - y };
    }
  }

  const scale = Math.min(1, maxHeight / box.h, maxWidth / box.w);
  const width = Math.max(1, Math.round(box.w * scale));
  const height = Math.max(1, Math.round(box.h * scale));
  const out = Object.assign(document.createElement('canvas'), { width, height });
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(src, box.x, box.y, box.w, box.h, 0, 0, width, height);
  return { dataUrl: out.toDataURL('image/jpeg', 0.92), width, height };
}
