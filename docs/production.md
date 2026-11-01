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

## Modalità senza Resend

La versione corrente non richiede un dominio email. L’admin prepara il link personale, lo copia e lo condivide direttamente. Il destinatario apre `/invito`, preme il pulsante di conferma e sceglie la password. Il token non viene consumato dalle normali scansioni GET delle email o dei servizi di anteprima.

Per il recupero dell’accesso lo studente contatta il team: l’admin genera un nuovo link dalla scheda. La pagina pubblica non promette un’email che il servizio non è configurato per inviare.

Resend è integrato ma l’opzione di invio rimane nascosta senza mittente configurato. Un test tecnico è stato accettato dall’indirizzo di test ufficiale del provider; nessun invito è stato inviato a persone reali. Per abilitare l’email in futuro:

1. Verificare un dominio mittente in Resend tramite i DNS del dominio scelto dal cliente.
2. Impostare `RESEND_FROM_EMAIL` sul progetto Vercel e ridistribuire.
3. Per il recupero password autonomo, configurare anche SMTP e template in Supabase Auth, quindi abilitare `AUTH_EMAIL_ENABLED=true`.

Il servizio segnala conferma o mancata conferma dell’invio; in caso di errore conserva l’alternativa del link manuale. Non effettua reinvii automatici.

## Verifiche di questo passaggio

62 test automatici, lint, TypeScript e build locale. Sette prove sul database reale: salvataggio delle abilitazioni, scansioni del link non distruttive e conferma POST con controllo dell’origine, isolamento online/sede, limiti concorrenti, cancellazione dopo riduzione dei servizi, invio email disabilitato correttamente.

Stato e prove del deployment vengono riportati nel resoconto di rilascio dopo il controllo dell’indirizzo pubblico.
