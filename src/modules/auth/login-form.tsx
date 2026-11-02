"use client";
import { useActionState } from "react";
import { signIn } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/modules/crm/ui";
export function LoginForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(signIn, { error: "" });
  return (
    <form action={action} className="mt-8 space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          disabled={!enabled || pending}
          placeholder="nome@esempio.it"
          className="h-11 rounded-xl"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={!enabled || pending}
          className="h-11 rounded-xl"
        />
      </div>
      <FormError message={state.error} />
      <Button
        type="submit"
        size="lg"
        disabled={!enabled || pending}
        className="mt-2 w-full"
      >
        {pending ? "Accesso in corso…" : "Accedi"}
      </Button>
    </form>
  );
}
