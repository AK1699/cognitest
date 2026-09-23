export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-primary-deep">{title}</h1>
      <div className="mt-6 flex max-w-xl flex-col gap-3 rounded-card border border-dashed border-line bg-white p-8">
        <span className="w-fit rounded-full bg-accent-tint px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-deep">
          Coming soon
        </span>
        <p className="text-sm leading-relaxed text-muted">{blurb}</p>
        <p className="text-sm text-muted">
          The permission model already reserves access rules for this module, so roles will apply
          the moment it ships.
        </p>
      </div>
    </div>
  );
}
