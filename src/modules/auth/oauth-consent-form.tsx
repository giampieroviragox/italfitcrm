"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/modules/crm/ui";
import { decideAuthorization } from "./oauth-actions";

export function OAuthConsentForm({
  authorizationId,
  canApprove,
}: {
  authorizationId: string;
  canApprove: boolean;
}) {
  const [state, action, pending] = useActionState(decideAuthorization, {
    error: "",
  });
  return (
    <form action={action} className="mt-8 space-y-3">
      <input type="hidden" name="authorization_id" value={authorizationId} />
      <FormError message={state.error} />
      {canApprove && (
        <Button
          type="submit"
          name="decision"
          value="approve"
          size="lg"
          disabled={pending}
          className="w-full"
        >
          {pending ? "Attendi…" : "Consenti"}
        </Button>
      )}
      <Button
        type="submit"
        name="decision"
        value="deny"
        size="lg"
        variant="outline"
        disabled={pending}
        className="w-full"
      >
        Rifiuta
      </Button>
    </form>
  );
}
