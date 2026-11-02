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

Il progetto configurato in questo workspace è [TEAM ITALFIT CRM](https://supabase.com/dashboard/project/nvvaxfhpcsizchzaykoi). URL locale: [127.0.0.1:3000](http://127.0.0.1:3000). Il progetto di hosting dedicato è `italfitcrm` su Vercel. Il proprietario iniziale è già stato creato; la password non è conservata nei file del progetto. Senza variabili Supabase è disponibile il fallback dimostrativo locale.

## Funzioni

- Login email/password, sessioni SSR, logout e recupero password. Registrazione pubblica disattivata. Ruoli owner/admin/student verificati sul server.
- CRM studenti: creazione in una modale con nome, cognome, email, telefono con prefisso, tier e data di creazione automatica; Un singolo studente può avere Coaching online, Allenamento in sede o entrambi. Coach e proprietà personalizzate si gestiscono direttamente nella scheda studente, con salvataggio e annullamento. La scheda mostra e gestisce l’accesso alla piattaforma, senza stati CRM aggiuntivi. Le proprietà vengono create soltanto esplicitamente dall’admin; dalla scheda si attiva e disattiva l’accesso personale senza eliminare lo studente.
- Undici tipi di proprietà: testo, multiriga, numero, data, dropdown, radio, scelta multipla, booleano, link, email e telefono. Dalle impostazioni si scelgono nome e tipo (più le opzioni per i campi a scelta); la Key si genera dal nome con suffissi univoci, resta stabile alle rinomine e riserva i nomi dei campi di sistema; archiviazione senza perdita dei valori.
- Viste per account: ricerca, filtri tipizzati in AND, colonne riordinabili con anteprima inclinata al trascinamento e comandi da tastiera, ordinamento, tabella/schede, paginazione e modifiche massive. Ricerca con aggiornamento immediato e persistenza delle preferenze con debounce. CSV dei risultati filtrati con neutralizzazione delle formule.
- Commenti interni permanenti con autore, data e lista scorrevole; cronologia generata dal server con valori prima/dopo per anagrafica, proprietà, tier, piani, prenotazioni, lezioni e accessi. Errori e modifiche concorrenti non generano conferme di salvataggio false.
- Impostazioni · Utenti: amministratori e studenti, accessi, inviti e permessi. Il ruolo si sceglie alla creazione e non cambia. Più amministratori con gestione riservata al proprietario. La scheda CRM e l’identità Auth sono distinte: alla creazione di uno studente l’admin sceglie tra solo scheda e scheda con accesso; il pulsante Invita prepara l’accesso anche in seguito.
- Inviti con link personali temporanei, copiabili dall’admin. Il destinatario vede l’email già compilata e non modificabile e inserisce due volte la password; al salvataggio entra nella propria area. La modalità corrente usa link condivisi manualmente e non dipende da Resend. Per recuperare l’accesso lo studente chiede un nuovo link al team. L’invio email è disponibile solo dopo la configurazione di un mittente verificato; il recupero email richiede anche SMTP Auth e `AUTH_EMAIL_ENABLED=true`.
- Piani: bozze, pubblicazione, archiviazione e programmi fino a 52 sessioni, organizzabili per settimana e giornata. Serie, ripetizioni o durata, recupero, riscaldamento, defaticamento e progressioni. Periodo originale, obiettivo e zone di passo facoltativi. Un piano per studente/mese con copia indipendente dal modello.
- Disponibilità: calendario settimanale in Lezioni dove ogni amministratore seleziona i propri slot da un’ora trascinando sui giorni; aggiunte e rimozioni restano in bozza finché non le conferma. Salvate nella scheda amministratore, senza prenotazione studenti per ora.
- Lezioni: agenda settimanale, orari di Roma, durata, coach, sala, capienza, iscrizioni e annullamenti. Controlli su orari, sovrapposizioni e posti anche con richieste simultanee.
- Area studente con home semplice e accessi separati a Piano e Prenotazioni, mostrati in base all’unione dei servizi assegnati. Area studente reale: piano con navigazione per settimane e giornate, illustrazioni vettoriali di corsa e forza e modalità allenamento guidata. Timer sui recuperi prescritti, completamento e note personali salvati sul server; nessuna foto o video nella vista. Lo staff dispone dell’anteprima con selettore. Restano disponibili prenotazione e annullamento delle lezioni abilitate.
- Home con dati attuali e attività recenti, ricerca globale ⌘K/CtrlK, shortcut N, sidebar riducibile e navigazione mobile.
- Select, checkbox e radio personalizzati con Radix: tastiera, focus, popup entro viewport, validazione e protezione dei form modificati.
- Stato di sincronizzazione e recupero dagli errori senza chiudere il form; letture e scritture serializzate per evitare aggiornamenti obsoleti. Nessun reinvio automatico di salvataggi dall’esito incerto.
- Area studente con mesi assegnati selezionabili, vista delle proprie prenotazioni, disponibilità aggiornabile e conferma prima di annullare un posto.

## Dati e sicurezza

Le tabelle hanno RLS, vincoli univoci, chiavi esterne e indici. Le API autenticano l’utente e validano ogni operazione; le RPC di scrittura sono disponibili soltanto al service role server. Un controllo di revisione impedisce sovrascritture simultanee. Gli studenti non ricevono note interne, proprietà CRM, amministratori o contatti altrui. Le note di allenamento e i completamenti sono dati del percorso, separati dalle proprietà personalizzate: l’API li collega sul server esclusivamente allo studente autenticato, alla versione assegnata del piano e a una sessione valida. Le modifiche dello staff preservano questi dati.

Le chiavi sono in `.env.local`, ignorato dal repository. Le chiavi server e Resend non hanno il prefisso `NEXT_PUBLIC_`. Il personal access token usato per configurare il progetto non serve a eseguire l’app e non viene conservato nel repository.

I dati dimostrativi del vecchio localStorage non vengono importati automaticamente. Le abilitazioni sono esplicite: Coaching online include i piani, Allenamento in sede include le lezioni; i tier con entrambi i servizi e il limite mensile facoltativo restano supportati, ma non sono più modificabili dalle impostazioni. Il server applica queste regole anche alle richieste dirette. Inviti e reinviti aprono direttamente il form password con l’email protetta da firma server: una semplice apertura del link non consuma il token, verificato soltanto al salvataggio. La modalità con link manuali permette il rilascio senza un dominio email. Per il dominio pubblico e la configurazione di produzione vedi [production.md](docs/production.md).

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

Il piano di qualità UX e i criteri di accettazione sono in [quality-plan.md](docs/quality-plan.md).
