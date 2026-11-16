export function PageHeading({
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:mb-6 sm:flex-row sm:items-center">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-[2rem] leading-tight font-bold tracking-[-0.05em] sm:text-[2.5rem]">
          {title.replace(/\.$/, "")}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
}
