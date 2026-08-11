import { useId, useState } from 'react';

function StarIcon({ fill = 'empty', halfId }) {
  if (fill === 'half') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <defs>
          <linearGradient id={halfId}>
            <stop offset="50%" stopColor="var(--accent)" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path
          d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3 6.2 20.4l1.1-6.5L2.6 9.3l6.5-.9L12 2.5z"
          fill={`url(#${halfId})`}
          stroke="var(--accent)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3 6.2 20.4l1.1-6.5L2.6 9.3l6.5-.9L12 2.5z"
        fill={fill === 'full' ? 'var(--accent)' : 'transparent'}
        stroke="var(--accent)"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity={fill === 'empty' ? 0.45 : 1}
      />
    </svg>
  );
}

function fillForStar(star, value) {
  if (value >= star) return 'full';
  if (value >= star - 0.5) return 'half';
  return 'empty';
}

/** Letterboxd-style: first click = half star, second click = full, third = clear. */
export function nextHalfStarRating(star, current) {
  const half = star - 0.5;
  const full = star;
  if (current === full) return null;
  if (current === half) return full;
  return half;
}

export default function StarRating({ value = null, disabled = false, onChange }) {
  const reactId = useId().replace(/:/g, '');
  const [hover, setHover] = useState(null);
  const display = hover ?? value ?? 0;

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHover(null)}
      role="group"
      aria-label={`Rating ${value ?? 0} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          className="rounded p-0.5 transition enabled:hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Rate ${star} stars`}
          onMouseEnter={() => setHover(star)}
          onFocus={() => setHover(star)}
          onBlur={() => setHover(null)}
          onClick={() => onChange?.(nextHalfStarRating(star, value))}
        >
          <StarIcon fill={fillForStar(star, display)} halfId={`${reactId}-half-${star}`} />
        </button>
      ))}
    </div>
  );
}
