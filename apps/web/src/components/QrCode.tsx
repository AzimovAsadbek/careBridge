'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(value, { width: size, margin: 1, color: { dark: '#0b3b35', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [value, size]);
  return src ? <img src={src} width={size} height={size} alt={`QR: ${value}`} /> : <div style={{ width: size, height: size }} className="animate-pulse rounded bg-slate-100" />;
}
