import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

/** Centered single-task frame for sign-in, invitation and password pages. */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-14 items-center justify-between px-5 sm:px-6">
        <Link href="/login" aria-label="Team Italfit">
          <Brand />
        </Link>
        <ThemeToggle />
      </header>
      <section className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center px-5 pb-24">
        <h1 className="text-2xl leading-[30px] font-medium tracking-[-0.02em]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
        {children}
        {footer && (
          <div className="mt-6 text-center text-[13px] text-muted-foreground">
            {footer}
          </div>
        )}
      </section>
    </main>
  );
}
