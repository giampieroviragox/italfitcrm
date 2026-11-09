import { createMcpHandler, getPublicOrigin, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { appUrl } from "@/lib/supabase/config";
import {
  applyDraftPlan,
  applyPlanEdits,
  mcpPlanFormat,
  mcpPlanTemplate,
  mcpPlanTemplates,
  mcpStudentPlan,
  mcpStudents,
} from "@/modules/crm/mcp-plans";
import { mcpPrincipal, verifyMcpToken } from "@/modules/crm/server/mcp-auth";
import type { CrmState } from "@/modules/crm/model";
import { HttpError } from "@/modules/crm/server/errors";
import { readCrm, writeCrm } from "@/modules/crm/server/repository";
import { validateStaffUpdate } from "@/modules/crm/server/validation";

const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

async function crmState(authInfo: Parameters<typeof mcpPrincipal>[0]) {
  const { userId } = mcpPrincipal(authInfo);
  return (await readCrm(userId)).state;
}

const text = (max: number) => z.string().max(max);
const exerciseSchema = z.object({
  id: text(100).optional(),
  name: text(200).describe("Nome dell’esercizio."),
  sets: z.number().int().min(1).max(20).describe("Serie, da 1 a 20."),
  reps: text(200).describe('Ripetizioni o durata, es. "8-10" o "45 s".'),
  restSeconds: z
    .number()
    .int()
    .min(0)
    .max(900)
    .describe("Recupero in secondi, da 0 a 900."),
  notes: text(2000).optional(),
  videoUrl: z
    .url({ protocol: /^https?$/ })
    .max(500)
    .optional(),
});
const sessionSchema = z.object({
  id: text(100).optional(),
  name: text(200).min(1).describe("Nome della sessione."),
  week: z.number().int().min(1).max(52).optional(),
  day: text(40).optional().describe('Giorno, es. "Lunedì".'),
  kind: z.enum(["strength", "run"]).optional(),
  preparation: text(4000).optional().describe("Riscaldamento."),
  cooldown: text(4000).optional().describe("Defaticamento."),
  guidance: text(4000).optional().describe("Indicazioni per lo studente."),
  exercises: z.array(exerciseSchema).max(30),
});
const programSchema = z.object({
  goal: text(300),
  startsOn: z.iso.date().describe("AAAA-MM-GG"),
  endsOn: z.iso.date().describe("AAAA-MM-GG, non prima di startsOn"),
  guidance: text(4000),
  paceZones: z.array(z.object({ name: text(80), pace: text(80) })).max(12),
});

// Read, change and write the CRM; one retry if it changed in between.
async function commitChange<T extends { state: CrmState }>(
  authInfo: Parameters<typeof mcpPrincipal>[0],
  change: (state: CrmState) => T,
): Promise<T> {
  const { userId, access } = mcpPrincipal(authInfo);
  for (let attempt = 0; ; attempt++) {
    const current = await readCrm(userId);
    const result = change(current.state);
    try {
      await writeCrm(
        userId,
        current.revision,
        validateStaffUpdate(current.state, result.state, access),
      );
      return result;
    } catch (error) {
      if (error instanceof HttpError && error.status === 409 && attempt < 1)
        continue;
      throw error;
    }
  }
}

const failure = (error: unknown) => ({
  ...json({
    salvato: false,
    motivo:
      error instanceof Error ? error.message : "Salvataggio non riuscito.",
  }),
  isError: true,
});

const planLink = (request: Request | undefined, id: string) =>
  `${request ? getPublicOrigin(request) : appUrl().replace(/\/$/, "")}/admin/piani/${encodeURIComponent(id)}`;

const id = text(100).min(1);
const after = (label: string) =>
  id
    .nullable()
    .optional()
    .describe(
      `Inserisci dopo questo ${label} (ID). null = in testa; omesso = in fondo.`,
    );
const sessionFields = z.object({
  name: text(200).min(1).optional(),
  week: z.number().int().min(1).max(52).nullable().optional(),
  day: text(40).nullable().optional(),
  kind: z.enum(["strength", "run"]).nullable().optional(),
  preparation: text(4000).nullable().optional(),
  cooldown: text(4000).nullable().optional(),
  guidance: text(4000).nullable().optional(),
});
const exerciseFields = z.object({
  name: text(200).min(1).optional(),
  sets: z.number().int().min(1).max(20).optional(),
  reps: text(200).optional(),
  restSeconds: z.number().int().min(0).max(900).optional(),
  notes: text(2000).optional(),
  videoUrl: z
    .url({ protocol: /^https?$/ })
    .max(500)
    .nullable()
    .optional(),
});
const newExercise = exerciseSchema.omit({ id: true });
const editSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("piano"),
    title: text(200).min(1).optional(),
    description: text(4000).optional(),
    program: programSchema.nullable().optional(),
  }),
  z.object({
    tipo: z.literal("modifica_sessione"),
    sessioneId: id,
    campi: sessionFields.describe("Solo i campi da cambiare; null li svuota."),
  }),
  z.object({
    tipo: z.literal("aggiungi_sessione"),
    sessione: sessionSchema.omit({ id: true }).extend({
      exercises: z.array(newExercise).max(30),
    }),
    dopoSessioneId: after("sessione"),
  }),
  z.object({ tipo: z.literal("rimuovi_sessione"), sessioneId: id }),
  z.object({
    tipo: z.literal("sposta_sessione"),
    sessioneId: id,
    dopoSessioneId: id.nullable().describe("null = in testa."),
  }),
  z.object({
    tipo: z.literal("modifica_esercizio"),
    sessioneId: id,
    esercizioId: id,
    campi: exerciseFields.describe("Solo i campi da cambiare."),
  }),
  z.object({
    tipo: z.literal("aggiungi_esercizio"),
    sessioneId: id,
    esercizio: newExercise,
    dopoEsercizioId: after("esercizio"),
  }),
  z.object({
    tipo: z.literal("rimuovi_esercizio"),
    sessioneId: id,
    esercizioId: id,
  }),
  z.object({
    tipo: z.literal("sposta_esercizio"),
    sessioneId: id,
    esercizioId: id,
    versoSessioneId: id
      .optional()
      .describe("Sessione di destinazione, se diversa."),
    dopoEsercizioId: id.nullable().describe("null = in testa."),
  }),
]);

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "cerca_studenti",
      {
        title: "Cerca studenti",
        description:
          "Cerca gli studenti Team Italfit per nome e cognome. Senza testo li elenca tutti (fino a 50). Restituisce il totale, se l’elenco è completo e, per ogni studente, ID, tier, se il servizio piani è attivo e i mesi che hanno già un piano.",
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
      "salva_bozza_piano",
      {
        title: "Salva una bozza di piano",
        description:
          "Salva nel CRM un piano di allenamento come BOZZA. Senza modelloId crea una nuova bozza; con modelloId sostituisce il contenuto di una bozza esistente (i piani pubblicati non si modificano). Consulta prima formato_piano. Non pubblica e non assegna: restituisce il link che l’admin apre per controllare, pubblicare e assegnare il piano allo studente. Se l’admin ha indicato studente e mese, riportali nella risposta come promemoria.",
        inputSchema: z.object({
          modelloId: text(100)
            .optional()
            .describe("ID di una bozza esistente da sostituire."),
          title: text(200).min(1).describe("Titolo del piano."),
          description: text(4000).describe("Descrizione, anche vuota."),
          program: programSchema.optional(),
          sessions: z.array(sessionSchema).max(52),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async (input, ctx) => {
        try {
          const { plan, created } = await commitChange(
            ctx.http?.authInfo,
            (state) => applyDraftPlan(state, input, () => crypto.randomUUID()),
          );
          return json({
            salvato: true,
            nuovaBozza: created,
            modelloId: plan.id,
            titolo: plan.title,
            sessioni: plan.sessions.length,
            esercizi: plan.sessions.reduce(
              (total, session) => total + session.exercises.length,
              0,
            ),
            link: planLink(ctx.http?.req, plan.id),
            prossimiPassi:
              "L’admin apre il link, controlla la bozza, la pubblica e la assegna allo studente per il mese scelto.",
          });
        } catch (error) {
          return failure(error);
        }
      },
    );
    server.registerTool(
      "modifica_bozza_piano",
      {
        title: "Modifica una bozza di piano",
        description:
          "Applica modifiche mirate a una BOZZA esistente senza riscriverla tutta: dati del piano, aggiunta, modifica, rimozione o spostamento di sessioni ed esercizi. Leggi prima la bozza con leggi_modello_piano per ottenere gli ID. Le operazioni si applicano in ordine e tutte insieme: se una fallisce non viene salvato nulla. Solo le bozze sono modificabili; non pubblica e non assegna.",
        inputSchema: z.object({
          modelloId: id.describe("ID della bozza."),
          operazioni: z.array(editSchema).min(1).max(100),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ modelloId, operazioni }, ctx) => {
        try {
          const { plan, changes } = await commitChange(
            ctx.http?.authInfo,
            (state) =>
              applyPlanEdits(state, modelloId, operazioni, () =>
                crypto.randomUUID(),
              ),
          );
          return json({
            salvato: true,
            modelloId: plan.id,
            titolo: plan.title,
            modifiche: changes,
            sessioni: plan.sessions.length,
            link: planLink(ctx.http?.req, plan.id),
          });
        } catch (error) {
          return failure(error);
        }
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
    serverInfo: { name: "team-italfit-crm", version: "0.3.0" },
    instructions:
      "Strumenti del CRM Team Italfit per consultare studenti e piani di allenamento, salvare nuovi piani come bozze e modificare le bozze esistenti. Per piccole modifiche usa modifica_bozza_piano invece di riscrivere il piano. Rispondi in italiano. Gli ID vanno ricavati dagli strumenti, mai inventati. Prima di salvare consulta formato_piano e conferma con l’admin il contenuto del piano.",
  },
);

const authHandler = withMcpAuth(
  handler,
  (_request, bearer) => verifyMcpToken(bearer),
  { required: true },
);

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
