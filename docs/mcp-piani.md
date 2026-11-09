# Connettore MCP per i piani (bozza di progetto)

Obiettivo: l’admin lavora ai piani nella chat di claude.ai con il proprio abbonamento e li salva nel CRM come **bozza**, senza chiave API Anthropic e senza accesso al codice. La pubblicazione allo studente resta un’azione manuale nel CRM.

Stato (9 novembre 2026): fasi 1–3 completate, più le modifiche mirate. Il connettore è collegato da claude.ai in produzione. Dopo ogni cambio dell’elenco o degli schemi degli strumenti serve ⋯ → “Aggiorna elenco strumenti” nel connettore su claude.ai.

Modifiche mirate: `modifica_bozza_piano` applica in ordine e in modo atomico fino a 100 operazioni su una bozza (`piano`, `modifica_sessione`, `aggiungi_sessione`, `rimuovi_sessione`, `sposta_sessione`, `modifica_esercizio`, `aggiungi_esercizio`, `rimuovi_esercizio`, `sposta_esercizio`); posizioni con “dopo ID” (null = in testa), campi facoltativi svuotabili con null, errori con il numero dell’operazione. Solo bozze.

Fase 3: `salva_bozza_piano` crea una nuova bozza o sostituisce il contenuto di una bozza esistente; i piani pubblicati o archiviati non si modificano. Gli ID di sessioni ed esercizi sono facoltativi e generati dal server. Il salvataggio passa da `validateStaffUpdate` e `crm_write` con controllo di revisione (un nuovo tentativo in caso di conflitto) e restituisce il link alla bozza, costruito sull’host della richiesta. Pubblicazione e assegnazione restano nel CRM. `cerca_studenti` restituisce anche `totale` e `completo`. Verificato in locale con una bozza tecnica poi eliminata: creazione, aggiornamento, rifiuto su piano pubblicato, input fuori limite e date incoerenti. Nota: `crm_write` aggiorna i piani ma non li cancella; le rimozioni passano da `crm_remove` (migrazione `20261109190000_italfit_record_removal`).

Fase 2: OAuth server attivo su Supabase con registrazione dinamica; Site URL `https://italfitcrm.vercel.app`, Authorization Path predefinito `/oauth/consent`, che reindirizza alla pagina `/oauth/consenso`. La pagina richiede il login (con ritorno automatico al consenso), accetta solo owner/admin attivi e consente l’approvazione solo per i callback di Claude (in sviluppo anche loopback). Flusso verificato in locale con un client tecnico poi eliminato: registrazione, consenso, token con `client_id`, chiamata a `/api/mcp`, revoca con 401 immediato.

Fase 1: `/api/mcp` espone in sola lettura `cerca_studenti`, `leggi_piano_studente`, `elenca_modelli_piano`, `leggi_modello_piano` e `formato_piano`; `/.well-known/oauth-protected-resource` indica Supabase come server di autorizzazione. In produzione sono accettati solo token OAuth (claim `client_id`) di owner/admin attivi; in sviluppo anche i token di sessione, per provare l’endpoint prima di attivare l’OAuth server.

## Verifiche

| Requisito                                  | Esito                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Connettori personalizzati su claude.ai     | Disponibili su Free (1 connettore), Pro, Max, Team, Enterprise; funzione in beta. Su Team/Enterprise li aggiunge l’owner dell’organizzazione.                      |
| Callback OAuth di Claude                   | `https://claude.ai/api/mcp/auth_callback` (prevedere anche `https://claude.com/api/mcp/auth_callback`).                                                            |
| Registrazione client                       | Claude supporta Dynamic Client Registration (RFC 7591); in alternativa client ID/secret in “Impostazioni avanzate”.                                                |
| Server OAuth 2.1 Supabase                  | In beta, incluso in tutti i piani, nessun costo aggiuntivo (gli utenti contano come MAU). Authorization code + PKCE e refresh token; nessuno scope personalizzato. |
| Chiavi di firma del progetto               | Già asimmetriche (ES256, JWKS pubblico): i token si verificano lato server senza segreti condivisi.                                                                |
| Server OAuth sul progetto TEAM ITALFIT CRM | Attivato il 9 novembre 2026 con registrazione dinamica.                                                                                                            |

Il token emesso da Supabase per Claude è un normale JWT utente (`sub` = utente, `role: authenticated`, `aud: authenticated`) con in più il claim `client_id`. Gli scope non limitano i permessi: li limitiamo noi nei tool e nel database.

## Architettura

```
claude.ai ──HTTPS──▶ /api/mcp (Next.js, Vercel)
   │                    ├─ verifica JWT via JWKS (iss, aud, exp, client_id presente)
   │                    ├─ crm_access: owner/admin attivo, altrimenti 403
   │                    └─ readCrm → modifica piano → validateStaffUpdate → writeCrm (revisione)
   │
   └─ OAuth ──▶ Supabase Auth (authorize/token/register)
                   └─ consenso ▶ /oauth/consenso (pagina del CRM, solo staff)
```

Componenti da aggiungere:

1. **`/api/mcp`**: server MCP con trasporto Streamable HTTP (`mcp-handler` + `@modelcontextprotocol/sdk`), stateless, compatibile con Vercel.
2. **`/.well-known/oauth-protected-resource`**: metadati RFC 9728 che indicano a Claude il server di autorizzazione Supabase.
3. **`/oauth/consenso`**: pagina di consenso. Richiede il login, accetta soltanto owner/admin attivi e soltanto i redirect di Claude; mostra “Claude potrà leggere gli studenti e creare bozze di piani” e chiama `approveAuthorization` / `denyAuthorization`.
4. **Gestione accessi** in Impostazioni: elenco delle app autorizzate (`listGrants`) e revoca (`revokeGrant`).
5. **Variante token di `requireAccess`**: stessa logica di oggi ma partendo dal bearer token invece dei cookie.

## Strumenti esposti a Claude

| Tool                | Effetto   | Dati restituiti                                                                                                                                                              |
| ------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cerca_studenti`    | Lettura   | ID, nome, servizi attivi (piani sì/no). Niente contatti, note o proprietà.                                                                                                   |
| `leggi_piano`       | Lettura   | Piano assegnato a uno studente per un mese, o un modello esistente.                                                                                                          |
| `formato_piano`     | Lettura   | Schema e regole: settimane, giorni, tipo forza/corsa, serie, ripetizioni, recuperi, zone di passo, massimo 52 sessioni.                                                      |
| `salva_bozza_piano` | Scrittura | Crea o aggiorna **solo piani in stato bozza**; mai pubblicazione, archiviazione o cancellazione. Errori leggibili per far correggere Claude. Restituisce il link alla bozza. |

Ogni scrittura passa da `validateStaffUpdate` e `crm_write` con controllo di revisione, quindi resta nella cronologia con autore. In cronologia aggiungiamo l’origine “tramite Claude”.

## Sicurezza

- Utente e ruolo ricavati solo dal token verificato e da `crm_access`; gli studenti che completassero l’OAuth ricevono 403 su ogni tool e vengono rifiutati già nella pagina di consenso.
- La registrazione dinamica è aperta per natura: il filtro è la pagina di consenso (login staff + redirect consentiti).
- Hardening consigliato: policy RLS `RESTRICTIVE` che negano l’accesso diretto PostgREST ai token con `client_id` sulle tabelle CRM, così il token di Claude funziona solo attraverso `/api/mcp`.
- Limite di dimensione delle richieste, limitazione di frequenza per utente, nessun dato di contatto nelle risposte.

## Azioni richieste all’owner (dashboard Supabase)

1. Authentication → OAuth Server → abilitare “OAuth 2.1 server”.
2. Abilitare “Allow Dynamic OAuth Apps”.
3. Authorization Path: va bene il predefinito `/oauth/consent` (reindirizza a `/oauth/consenso`).
4. Controllare che il Site URL sia il dominio pubblico del CRM: l’URL di consenso è Site URL + Authorization Path.

## Rischi e punti aperti

- **Beta su entrambi i lati** (connettori Claude e OAuth Supabase): possibili cambiamenti o difetti, da riverificare prima del rilascio.
- **Test end-to-end**: claude.ai deve raggiungere un URL pubblico in HTTPS e il consenso usa il Site URL. Il percorso più pulito è il deploy di produzione con il connettore non ancora comunicato al cliente; in locale si prova con MCP Inspector e un tunnel.
- **Dimensione dello stato**: oggi il CRM si salva come documento unico versionato; se l’admin modifica il CRM mentre Claude salva, Claude riceve un 409 e riprova sulla revisione nuova.
- **Prerequisito tecnico**: Node 24 e pnpm devono essere installati nel sistema per aggiungere le dipendenze rispettando il lockfile.

## Fasi

1. Endpoint MCP con autenticazione a token e tool di sola lettura; prova con MCP Inspector.
2. Pagina di consenso e attivazione OAuth su Supabase; collegamento reale da claude.ai.
3. `salva_bozza_piano` con validazione, cronologia e link alla bozza.
4. Gestione e revoca degli accessi nelle Impostazioni, policy RLS restrittive, test e documentazione per il cliente.
