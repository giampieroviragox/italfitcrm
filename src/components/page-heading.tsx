export function PageHeading({
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col items-start justify-between gap-5 sm:mb-8 xl:flex-row xl:items-start">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-[26px] leading-8 font-medium tracking-[-0.035em]">
          {title.replace(/\.$/, "")}
        </h1>
        {description && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
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
