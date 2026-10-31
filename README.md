# Team Italfit · CRM

Gestionale per studenti, programmi e lezioni, con Next.js App Router, React, TypeScript strict, Tailwind CSS, shadcn/Radix e Supabase.

## Avvio

Node.js 24 e pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# Configura i valori Supabase e l’URL dell’app nel file locale.
pnpm dev
```

Il progetto configurato in questo workspace è [TEAM ITALFIT CRM](https://supabase.com/dashboard/project/nvvaxfhpcsizchzaykoi). URL locale: [127.0.0.1:3000](http://127.0.0.1:3000). Il proprietario iniziale è già stato creato; la password non è conservata nei file del progetto. Senza variabili Supabase è disponibile il fallback dimostrativo locale.

## Funzioni

- Login email/password, sessioni SSR, logout e recupero password. Registrazione pubblica disattivata. Ruoli owner/admin/student verificati sul server.
- CRM studenti: anagrafica, telefono, stato, coach, tag, tier, proprietà personalizzate, archiviazione e ripristino.
- Undici tipi di proprietà: testo, multiriga, numero, data, dropdown, radio, scelta multipla, booleano, link, email e telefono. Gruppi, descrizione, obbligatorietà, opzioni univoche, archiviazione senza perdita dei valori. Campi fitness facoltativi.
- Viste per account: ricerca, filtri tipizzati in AND, colonne riordinabili, ordinamento, tabella/schede, paginazione e modifiche massive. Ricerca con aggiornamento immediato e persistenza delle preferenze con debounce. CSV dei risultati filtrati con neutralizzazione delle formule.
- Note interne datate e cronologia generata dal server; le nuove attività includono l’autore. Errori e modifiche concorrenti non generano conferme di salvataggio false.
- Più amministratori con gestione riservata al proprietario. La scheda CRM e l’identità Auth sono distinte: il pulsante Invita prepara l’accesso.
- Inviti con link personali temporanei, copiabili dall’admin. Il destinatario imposta la propria password. Non vengono spedite email automatiche; Resend è riservato al prossimo passaggio. Il recupero password usa il sistema email nativo Supabase.
- Piani: bozze, pubblicazione, archiviazione, sessioni/esercizi con serie, ripetizioni o durata, recupero, note e video. Un piano per studente/mese con copia indipendente dal modello.
- Lezioni: agenda settimanale, orari di Roma, durata, coach, sala, capienza, iscrizioni e annullamenti. Controlli su orari, sovrapposizioni e posti anche con richieste simultanee.
- Area studente reale: solo il proprio piano e le lezioni; prenotazione e annullamento. Lo staff dispone anche dell’anteprima con selettore.
- Home con dati attuali e attività recenti, ricerca globale ⌘K/CtrlK, shortcut N, sidebar riducibile e navigazione mobile.
- Select, checkbox e radio personalizzati con Radix: tastiera, focus, popup entro viewport, validazione e protezione dei form modificati.
- Esportazione JSON del CRM dalle impostazioni.

## Dati e sicurezza

Le tabelle hanno RLS, vincoli univoci, chiavi esterne e indici. Le API autenticano l’utente e validano ogni operazione; le RPC di scrittura sono disponibili soltanto al service role server. Un controllo di revisione impedisce sovrascritture simultanee. Gli studenti non ricevono note, proprietà interne, amministratori o contatti altrui.

Le chiavi sono in `.env.local`, ignorato dal repository. Le chiavi server e Resend non hanno il prefisso `NEXT_PUBLIC_`. Il personal access token usato per configurare il progetto non serve a eseguire l’app e non viene conservato nel repository.

I dati dimostrativi del vecchio localStorage non vengono importati automaticamente. Le abilitazioni dei contenuti per tier restano da definire. Per il deployment pubblico occorre impostare URL canonico/redirect del dominio e configurare l’email transazionale. L’attuale infrastruttura è collegata al database cloud, ma il frontend è ancora locale.

## Codice e verifiche

- `src/modules/crm/model.ts`, `logic.ts`, `fitness-logic.ts`, `schema.ts`: tipi, regole e validazione del dominio.
- `src/modules/crm/server/`: autorizzazioni, validazione delle scritture e repository Supabase.
- `src/modules/crm/remote-store.tsx`: adapter client con salvataggi in coda e conferma server; `store.ts` conserva il fallback locale.
- `src/app/api/`: CRM, inviti e prenotazioni.
- `src/lib/supabase/`: client SSR/browser/server e tipi generati dal database.
- `supabase/migrations/`: schema e transazioni applicate al progetto.

```sh
pnpm check
pnpm build
pnpm start
```

`check` esegue ESLint, TypeScript, unit test e Prettier. Le prove sul database cloud vengono eseguite separatamente con record tecnici, senza invio di email, poi ripuliti.

Vedi [architettura](docs/architecture.md), [design](DESIGN.md) e [verifiche](docs/verification.md).
