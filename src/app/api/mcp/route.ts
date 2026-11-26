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
import {
  readCrm,
  readStudentDetail,
  writeCrm,
} from "@/modules/crm/server/repository";
import { validateStaffUpdate } from "@/modules/crm/server/validation";
import {
  projectState,
  requirePermission,
  requireStudent,
  staffScope,
} from "@/modules/crm/permissions";
import { guidedCategories } from "@/modules/crm/plan-cycles";

const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

/** The CRM as the connected team member may see it (needs the plans permission). */
async function crmState(authInfo: Parameters<typeof mcpPrincipal>[0]) {
  const { userId, access } = mcpPrincipal(authInfo);
  const state = (await readCrm(userId)).state;
  const scope = staffScope(state, access.record_id);
  requirePermission(scope, "plans");
  return projectState(state, scope);
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
  studentId?: string,
): Promise<T> {
  const { userId, access } = mcpPrincipal(authInfo);
  for (let attempt = 0; ; attempt++) {
    const current = await readCrm(userId);
    const scope = staffScope(current.state, access.record_id);
    requirePermission(scope, "plans");
    // A coach saves drafts only for the students they follow.
    if (studentId) requireStudent(scope, studentId);
    const result = change(current.state);
    try {
      await writeCrm(
        userId,
        current,
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

const origin = (request: Request | undefined) =>
  request ? getPublicOrigin(request) : appUrl().replace(/\/$/, "");
const planLink = (request: Request | undefined, id: string) =>
  `${origin(request)}/admin/piani/${encodeURIComponent(id)}`;
/** The page where a draft shows up: its client or its guided program. */
const ownerLink = (
  request: Request | undefined,
  plan: { studentId?: string; guidedCategory?: string },
) =>
  plan.studentId
    ? `${origin(request)}/admin/coaching-online/${encodeURIComponent(plan.studentId)}`
    : plan.guidedCategory
      ? `${origin(request)}/admin/programmi-guidati/${plan.guidedCategory}`
      : undefined;
const recipientSchema = z
  .union([
    z.object({
      studenteId: text(100)
        .min(1)
        .describe("ID del cliente del Coaching online (da cerca_studenti)."),
    }),
    z.object({
      programmaGuidato: z
        .enum(guidedCategories.map((c) => c.id) as [string, ...string[]])
        .describe("Programma guidato di cui la bozza è una nuova versione."),
    }),
  ])
  .describe(
    "A chi appartiene la bozza: un cliente oppure un programma guidato. Obbligatorio per una nuova bozza.",
  );

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
          "Cerca gli studenti Team Italfit per nome e cognome. Senza testo li elenca tutti (fino a 50). Restituisce il totale, se l’elenco è completo e, per ogni studente, ID, tier, se il servizio piani è attivo, i cicli di 4 settimane già assegnati (inizio, fine, titolo) e i programmi guidati che segue.",
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
          "Restituisce un piano assegnato a uno studente (ciclo di 4 settimane) con il questionario di fine piano compilato dallo studente, il registro degli allenamenti svolti (serie, carichi, fatica e note) e le gare in programma. Con data (AAAA-MM-GG) restituisce il ciclo che comprende quel giorno, con mese (AAAA-MM) l'ultimo ciclo iniziato in quel mese, senza nessuno dei due il più recente. Usalo per preparare il piano successivo come bozza: il coach lo rivede prima della consegna.",
        inputSchema: z.object({
          studenteId: z.string().min(1).max(100),
          data: z.iso
            .date()
            .optional()
            .describe("Un giorno del ciclo, AAAA-MM-GG."),
          mese: z
            .string()
            .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Usa il formato AAAA-MM.")
            .optional(),
        }),
        annotations: readOnly,
      },
      async ({ studenteId, data, mese }, ctx) => {
        const state = await crmState(ctx.http?.authInfo);
        // The workout log is loaded for this one student, not for everyone.
        const detail = state.students.some((s) => s.id === studenteId)
          ? await readStudentDetail(studenteId)
          : null;
        return json(
          mcpStudentPlan(
            detail
              ? {
                  ...state,
                  students: state.students.map((s) =>
                    s.id === studenteId ? { ...s, ...detail.student } : s,
                  ),
                }
              : state,
            studenteId,
            data ?? mese,
          ),
        );
      },
    );
    server.registerTool(
      "elenca_modelli_piano",
      {
        title: "Elenca i modelli di piano",
        description:
          "Elenca i piani non archiviati del CRM con stato, numero di sessioni e a chi appartengono (studenteId del cliente o programmaGuidato).",
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
          "Salva nel CRM un piano di allenamento come BOZZA per un cliente del Coaching online (destinatario.studenteId) o come nuova versione di un programma guidato (destinatario.programmaGuidato). Senza modelloId crea una nuova bozza e il destinatario è obbligatorio; con modelloId sostituisce il contenuto di una bozza esistente (i piani pubblicati non si modificano). Consulta prima formato_piano. Non pubblica e non assegna: restituisce il link alla pagina del cliente o del programma, dove l’admin controlla, pubblica e assegna il ciclo di 4 settimane.",
        inputSchema: z.object({
          modelloId: text(100)
            .optional()
            .describe("ID di una bozza esistente da sostituire."),
          destinatario: recipientSchema.optional(),
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
            input.destinatario && "studenteId" in input.destinatario
              ? input.destinatario.studenteId
              : undefined,
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
            link:
              ownerLink(ctx.http?.req, plan) ??
              planLink(ctx.http?.req, plan.id),
            linkPiano: planLink(ctx.http?.req, plan.id),
            prossimiPassi: plan.guidedCategory
              ? "L’admin apre il programma guidato, controlla la bozza, la pubblica come versione corrente e la assegna agli abbonati da rinnovare."
              : "L’admin apre la pagina del cliente, controlla la bozza, la pubblica e assegna il prossimo ciclo di 4 settimane.",
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
    serverInfo: { name: "team-italfit-crm", version: "0.4.0" },
    instructions:
      "Strumenti del CRM Team Italfit per consultare studenti e piani di allenamento, salvare nuovi piani come bozze e modificare le bozze esistenti. Per piccole modifiche usa modifica_bozza_piano invece di riscrivere il piano. Rispondi in italiano. Gli ID vanno ricavati dagli strumenti, mai inventati. Prima di salvare consulta formato_piano e conferma con l’admin il contenuto del piano e il destinatario (cliente o programma guidato). I piani durano cicli di 4 settimane.",
  },
);

const authHandler = withMcpAuth(
  handler,
  (_request, bearer) => verifyMcpToken(bearer),
  { required: true },
);

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
