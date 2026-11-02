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
    <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-2xl leading-[30px] font-medium tracking-[-0.02em]">
          {title.replace(/\.$/, "")}
        </h1>
        {description && (
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
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
