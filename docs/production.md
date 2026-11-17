# Rilascio Italfit

## Servizi

- Repository privata: `giampieroviragox/italfitcrm`, ramo `main`.
- Progetto Vercel: `italfitcrm`, ID `prj_4ykOLLyGiHjnmYmWTSB7Aqo4Ucdx`.
- Spazio Vercel: `giampieroviragoxs-projects`, autorizzato dall’utente.
- Indirizzo assegnato: `https://italfitcrm.vercel.app`.
- Database dedicato: TEAM ITALFIT CRM, ref `nvvaxfhpcsizchzaykoi`.
- Node.js 24, pnpm 11.25.0, installazione con lockfile e build `pnpm check && pnpm build`.

Le chiavi private sono variabili server sensibili nell’ambiente di produzione. Nessuna chiave viene conservata in questo documento. I deployment privi della configurazione Supabase falliscono esplicitamente: il fallback dimostrativo non viene pubblicato al posto del gestionale reale.

## Accessi e tier

Configurazione confermata dall’utente il 1 novembre 2026:

- Coaching online: piani abilitati, lezioni disabilitate.
- Allenamento in sede: lezioni abilitate, piani disabilitati, nessun limite mensile iniziale.
- Un nuovo tier può abilitare entrambi o nessun servizio; l’admin sceglie esplicitamente le abilitazioni.

Le regole sono nel campo `entitlements` del tier, salvato nel payload Postgres. Non si inferiscono permessi dal nome. I tier precedenti senza configurazione mantengono la compatibilità; quelli iniziali sono stati configurati esplicitamente.

Il limite delle lezioni è facoltativo e segue il mese della lezione in Europe/Rome. Prenotazioni e lezioni annullate non consumano disponibilità. Il controllo usa la stessa transazione versionata delle prenotazioni, anche in concorrenza. Ridurre i servizi o il limite non elimina lo storico; lo studente può annullare posti già prenotati.

## Ruoli e permessi del team

Il proprietario è il super admin: vede tutto ed è l’unico che gestisce team, ruoli, permessi e compensi (Impostazioni → Team). Gli altri membri hanno un ruolo, **Admin** o **Coach**, che fissa i permessi predefiniti; il super admin può personalizzarli persona per persona. Ruolo, permessi e percentuale di compenso sono salvati nella scheda del membro e modificabili solo dal proprietario.

- Admin: studenti, piani, calendario, abbonamenti online, contabilità online, compensi, impostazioni. Non vede pagamenti e contabilità delle lezioni.
- Coach: solo i propri studenti (coach di riferimento, dell’abbonamento o di un piano mensile) e la libreria piani; vede solo il proprio compenso.

I permessi sono applicati dal server: lo stato inviato al browser è filtrato per membro, le scritture rimettono i dati nascosti e rifiutano le modifiche fuori ruolo, e ogni rotta controlla il permesso necessario. La migrazione `20261117180000_italfit_server_only_reads` rimuove la lettura diretta delle tabelle CRM da parte degli utenti autenticati: tutte le letture passano dal server. Applicata in produzione il 17 novembre 2026 tramite la Management API di Supabase e registrata in `supabase_migrations.schema_migrations`. La migrazione `20261118090000_italfit_tighten_self_grants` lascia agli utenti autenticati la sola lettura della propria riga in `crm_access` e `crm_preferences`; applicata il 18 novembre 2026.

## Inviti e recupero password con Resend

L’admin può inviare un invito o un reinvito via email oppure copiare e condividere il link personale. Il destinatario apre `/invito`, trova l’email già compilata e non modificabile e inserisce e conferma la password. Al salvataggio il server verifica il token e i permessi CRM, salva la password e apre l’area corretta. Email, tipo di invito e token sono protetti da una firma server. I link precedenti restano compatibili con il passaggio di conferma. L’anteprima GET può aprire il link e il token viene verificato al momento della conferma.

Per il recupero autonomo, lo studente apre **Password dimenticata?** e richiede un link. Supabase Auth invia l’email tramite SMTP Resend. Il template apre `/invito` con `TokenHash` e tipo `recovery`. La conferma esplicita invia il token a `/auth/confirm` e apre `/imposta-password`. Il link è utilizzabile una volta.

Il dominio verificato è `teamitalfit.com` e il mittente pubblico è `inviti@teamitalfit.com`. Gli inviti richiedono `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e l’URL pubblico HTTPS su Vercel. Per il recupero, Supabase usa `smtp.resend.com` sulla porta `465`, con utente `resend` e una chiave Resend come credenziale SMTP. Vercel abilita la pagina pubblica tramite `AUTH_EMAIL_ENABLED=true`.

Per pubblicare il template brandizzato di recupero, apri **Authentication → Email Templates → Reset password** in Supabase. Usa come oggetto **Reimposta la password di Team Italfit** e incolla [recovery.html](../supabase/templates/recovery.html) come corpo. Mantieni il passaggio intermedio su `/invito`: il recupero deve continuare solo dopo la conferma esplicita del destinatario. Inviti e reinviti usano i template inclusi nell’app e si aggiornano con il deploy del codice.

Il servizio segnala conferma o mancata conferma dell’invio; in caso di errore conserva l’alternativa del link manuale. Non effettua reinvii automatici.

## Verifiche di questo passaggio

62 test automatici, lint, TypeScript e build locale. Sette prove sul database reale: salvataggio delle abilitazioni, scansioni del link non distruttive e conferma POST con controllo dell’origine, isolamento online/sede, limiti concorrenti, cancellazione dopo riduzione dei servizi, invio email disabilitato correttamente.

Stato e prove del deployment vengono riportati nel resoconto di rilascio dopo il controllo dell’indirizzo pubblico.
