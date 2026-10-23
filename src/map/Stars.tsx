/** Shows 0–3 stars as pictures (the label is for screen readers / parents). */
export function Stars({ count }: { count: number }) {
  return (
    <span className="map-stars" aria-label={`${count} trên 3 sao`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= count ? undefined : 'map-star--off'} aria-hidden="true">
          ⭐
        </span>
      ))}
    </span>
  );
}
