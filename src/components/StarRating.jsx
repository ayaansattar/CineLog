import { useState } from 'react';

const STAR_PATH =
  'M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3 6.2 20.4l1.1-6.5L2.6 9.3l6.5-.9L12 2.5z';

function StarSvg({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 block" aria-hidden="true">
      <path
        d={STAR_PATH}
        fill={filled ? '#e8a54b' : 'transparent'}
        stroke="#e8a54b"
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity={filled ? 1 : 0.4}
      />
    </svg>
  );
}

function starFillPercent(star, value) {
  if (value >= star) return 100;
  if (value >= star - 0.5) return 50;
  return 0;
}

export default function StarRating({ value = null, disabled = false, onChange }) {
  const [hover, setHover] = useState(null);
  const display = hover ?? value ?? 0;

  function select(next) {
    if (disabled) return;
    // Clicking the same value again clears the rating
    onChange?.(value === next ? null : next);
  }

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHover(null)}
      role="group"
      aria-label={value == null ? 'No rating' : `Rated ${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const pct = starFillPercent(star, display);
        return (
          <span key={star} className="relative inline-block h-5 w-5 shrink-0">
            <StarSvg filled={false} />
            <span
              className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${pct}%` }}
            >
              <span className="block w-5">
                <StarSvg filled />
              </span>
            </span>

            <button
              type="button"
              disabled={disabled}
              aria-label={`Rate ${star - 0.5} stars`}
              className="absolute inset-y-0 left-0 z-10 w-1/2 disabled:cursor-not-allowed"
              onMouseEnter={() => setHover(star - 0.5)}
              onFocus={() => setHover(star - 0.5)}
              onClick={() => select(star - 0.5)}
            />
            <button
              type="button"
              disabled={disabled}
              aria-label={`Rate ${star} stars`}
              className="absolute inset-y-0 right-0 z-10 w-1/2 disabled:cursor-not-allowed"
              onMouseEnter={() => setHover(star)}
              onFocus={() => setHover(star)}
              onClick={() => select(star)}
            />
          </span>
        );
      })}
    </div>
  );
}
