/** Illustrative layout only: the assigned locker number remains authoritative. */
export function LockerPosition({ number }: { number: string }) {
  const assigned = Number(number);
  const valid = Number.isInteger(assigned) && assigned > 0 && assigned <= 99;
  const rows = Math.max(4, Math.ceil((valid ? assigned : 1) / 8));
  return (
    <figure className="locker-position">
      <figcaption className="locker-position__label">
        Your locker
        <strong>{number.padStart(2, "0")}</strong>
      </figcaption>
      {valid && (
        <div className="locker-position__grid" role="img" aria-label={`Illustrative locker layout. Locker ${assigned}, row ${Math.ceil(assigned / 8)}, column ${((assigned - 1) % 8) + 1}.`}>
          {Array.from({ length: rows * 8 }, (_, index) => (
            <span key={index} aria-hidden="true" className={`locker-position__cell${index + 1 === assigned ? " locker-position__cell--assigned" : ""}`} />
          ))}
        </div>
      )}
      <p className="locker-position__hint">Illustrative locker layout</p>
    </figure>
  );
}
