# Team Italfit Workspace

- Progetto: Next.js App Router, React, TypeScript strict, Tailwind CSS e shadcn/ui (Radix).
- Leggere la documentazione della versione installata in `node_modules/next/dist/docs/` prima di cambiare API o convenzioni Next.js.
- Consultare siti e documentazione via Computer Use quando necessario; non usare Firecrawl (preferenza esplicita dell’utente).
- Con `.env.local` configurato il progetto usa il database reale TEAM ITALFIT CRM. Nei test usare solo record tecnici identificabili e rimuoverli alla fine. Non usare fixture locali come dati di produzione.
- Il CRM usa sessioni SSR, ruoli in `crm_access`, RLS e API server con transazioni versionate. L’adapter locale è solo un fallback senza env. Non collegare il vecchio repository dimostrativo alle pagine operative. Non fidarsi mai del ruolo dichiarato dal client o dai user metadata.
- Segreti soltanto in file ambiente ignorati: nessuna chiave server nei bundle client o nella documentazione. Resend invia soltanto quando l’admin sceglie esplicitamente l’invito email, con dominio verificato e mittente configurato; nessun invio massivo automatico.
- Nessuna registrazione pubblica: gli studenti saranno creati e invitati dall’admin.
- Il 1 novembre 2026 l’utente ha confermato Coaching online → piani, Allenamento in sede → lezioni, tier completo → entrambi. Le regole sono salvate esplicitamente nel tier e applicate sul server: non derivare permessi dai nomi. Limite mensile delle lezioni facoltativo, calcolato sul mese della lezione in Europe/Rome. Una riduzione dei servizi conserva lo storico e consente di annullare prenotazioni esistenti.
- Il 2 novembre 2026 l’utente ha richiesto tier multipli per studente: `tierIds` contiene i tier assegnati, `tierId` conserva il primo ID per compatibilità. I servizi effettivi uniscono le policy esplicite dei tier; gli studenti precedenti con solo `tierId` restano compatibili. Lo stato CRM resta soltanto nei payload storici: la UI mostra l’accesso alla piattaforma e non Attivo/In pausa/Da attivare. Le nuove proprietà usano ID leggibili univoci (Key); gli ID esistenti restano immutati, anche se si rinomina il campo.
- UI in italiano, date `Europe/Rome`, layout responsive e controlli accessibili.
- Usare pnpm e preservare il lockfile. Prima della consegna: `pnpm check` e `pnpm build`, più verifica UI delle interazioni cambiate.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
