import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import {
  mcpPlanFormat,
  mcpPlanTemplate,
  mcpPlanTemplates,
  mcpStudentPlan,
  mcpStudents,
} from "@/modules/crm/mcp-plans";
import { mcpPrincipal, verifyMcpToken } from "@/modules/crm/server/mcp-auth";
import { readCrm } from "@/modules/crm/server/repository";

const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

async function crmState(authInfo: Parameters<typeof mcpPrincipal>[0]) {
  const { userId } = mcpPrincipal(authInfo);
  return (await readCrm(userId)).state;
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "cerca_studenti",
      {
        title: "Cerca studenti",
        description:
          "Cerca gli studenti Team Italfit per nome e cognome. Restituisce ID, tier, se il servizio piani è attivo e i mesi che hanno già un piano. Senza testo restituisce i primi studenti in ordine alfabetico.",
        inputSchema: z.object({
          testo: z
            .string()
            .max(80)
            .optional()
            .describe("Nome e/o cognome, anche parziali."),
        }),
        annotations: readOnly,
      },
      async ({ testo }, ctx) =>
        json(mcpStudents(await crmState(ctx.http?.authInfo), testo ?? "")),
    );
    server.registerTool(
      "leggi_piano_studente",
      {
        title: "Leggi il piano di uno studente",
        description:
          "Restituisce il piano assegnato a uno studente per un mese (AAAA-MM). Senza mese restituisce il più recente.",
        inputSchema: z.object({
          studenteId: z.string().min(1).max(100),
          mese: z
            .string()
            .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Usa il formato AAAA-MM.")
            .optional(),
        }),
        annotations: readOnly,
      },
      async ({ studenteId, mese }, ctx) =>
        json(
          mcpStudentPlan(await crmState(ctx.http?.authInfo), studenteId, mese),
        ),
    );
    server.registerTool(
      "elenca_modelli_piano",
      {
        title: "Elenca i modelli di piano",
        description:
          "Elenca i modelli di piano non archiviati del CRM con stato e numero di sessioni.",
        inputSchema: z.object({}),
        annotations: readOnly,
      },
      async (_input, ctx) =>
        json(mcpPlanTemplates(await crmState(ctx.http?.authInfo))),
    );
    server.registerTool(
      "leggi_modello_piano",
      {
        title: "Leggi un modello di piano",
        description:
          "Restituisce il contenuto completo di un modello di piano.",
        inputSchema: z.object({ modelloId: z.string().min(1).max(100) }),
        annotations: readOnly,
      },
      async ({ modelloId }, ctx) => {
        const plan = mcpPlanTemplate(
          await crmState(ctx.http?.authInfo),
          modelloId,
        );
        return plan
          ? json(plan)
          : {
              ...json({ trovato: false, motivo: "Modello non trovato." }),
              isError: true,
            };
      },
    );
    server.registerTool(
      "formato_piano",
      {
        title: "Formato dei piani",
        description:
          "Descrive la struttura e i limiti che un piano deve rispettare per essere salvato nel CRM. Consultalo prima di preparare un piano.",
        inputSchema: z.object({}),
        annotations: readOnly,
      },
      async (_input, ctx) => {
        mcpPrincipal(ctx.http?.authInfo);
        return { content: [{ type: "text" as const, text: mcpPlanFormat }] };
      },
    );
  },
  {
    serverInfo: { name: "team-italfit-crm", version: "0.1.0" },
    instructions:
      "Strumenti del CRM Team Italfit per consultare studenti e piani di allenamento. Rispondi in italiano. Gli ID vanno ricavati dagli strumenti, mai inventati.",
  },
);

const authHandler = withMcpAuth(
  handler,
  (_request, bearer) => verifyMcpToken(bearer),
  { required: true },
);

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
