export class RequestError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

/** Bounded requests, including response-body reads. Mutations are never replayed. */
export async function requestJson(
  url: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
  timeoutMs = 45_000,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new RequestError(
        response.ok
          ? "Risposta non leggibile. Aggiorna i dati prima di riprovare."
          : "Il servizio non ha risposto correttamente. Riprova tra poco.",
        response.status,
      );
    }
    if (!response.ok) {
      const message =
        response.status === 401
          ? "La sessione è scaduta. Accedi di nuovo per continuare."
          : typeof data === "object" &&
              data !== null &&
              "error" in data &&
              typeof data.error === "string"
            ? data.error
            : "Operazione non riuscita. Riprova tra poco.";
      throw new RequestError(message, response.status);
    }
    return data;
  } catch (error) {
    if (controller.signal.aborted)
      throw new RequestError(
        "Il servizio sta impiegando troppo tempo. Aggiorna i dati per verificare l’esito prima di riprovare.",
      );
    if (error instanceof RequestError) throw error;
    throw new RequestError(
      "Connessione interrotta. Aggiorna i dati per verificare l’esito prima di riprovare.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
