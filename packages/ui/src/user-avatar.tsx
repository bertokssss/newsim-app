'use client';

import * as React from 'react';
import { cn } from '@newsim/utils';

export interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fallback?: string;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  imgClassName?: string;
}

const SAFE_AVATAR_URL_RE =
  /^(?:https?:\/\/|\/(?!\/)|data:image\/(?:png|jpe?g|webp|gif|avif|bmp);)/i;

function sanitizeAvatarUrl(src?: string | null): string | null {
  if (typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  return SAFE_AVATAR_URL_RE.test(trimmed) ? trimmed : null;
}

export function getUserInitials({
  firstName,
  lastName,
  name,
  fallback = 'U',
}: Pick<UserAvatarProps, 'firstName' | 'lastName' | 'name' | 'fallback'>): string {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (f && l) {
    return `${f[0]}${l[0]}`.toUpperCase();
  }
  if (f || l) {
    const single = f || l;
    return single.slice(0, 2).toUpperCase();
  }

  const full = (name || '').trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }

  const fb = (fallback || 'U').trim();
  return (fb || 'U').slice(0, 2).toUpperCase();
}

/**
 * Shared profile avatar with safe image validation, loading fallback, and initials rendering.
 */
export function UserAvatar({
  src,
  name,
  firstName,
  lastName,
  fallback = 'U',
  alt,
  className,
  fallbackClassName,
  imgClassName,
}: UserAvatarProps) {
  const safeSrc = sanitizeAvatarUrl(src);
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);

  const showImage = Boolean(safeSrc) && failedSrc !== safeSrc;
  const initials = getUserInitials({ firstName, lastName, name, fallback });
  const resolvedAlt =
    alt ||
    [firstName, lastName].filter(Boolean).join(' ').trim() ||
    (name || '').trim() ||
    'User profile photo';

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl select-none',
        showImage
          ? 'bg-slate-100'
          : cn('bg-slate-800 text-white font-bold', fallbackClassName),
        className
      )}
    >
      {showImage ? (
        <img
          src={safeSrc!}
          alt={resolvedAlt}
          loading="lazy"
          className={cn('h-full w-full object-cover', imgClassName)}
          onError={() => setFailedSrc(safeSrc)}
        />
      ) : (
        <span aria-hidden="true" className="leading-none">
          {initials}
        </span>
      )}
    </div>
  );
}
