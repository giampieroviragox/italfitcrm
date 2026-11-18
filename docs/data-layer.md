# Livello dati del CRM

Il CRM non salva più "tutto lo stato" a ogni modifica. Ogni record ha una
versione, le scritture portano solo i record cambiati e le letture inviano solo
le differenze. Questo documento spiega come funziona e cosa resta da fare.

## Perché

Il modello precedente leggeva e riscriveva l'intero CRM a ogni operazione:
un blocco globale sulla revisione, un conflitto se due persone salvavano
qualunque cosa nello stesso momento, e un costo che cresceva con studenti,
allenamenti e cronologia. Misure su 600 studenti sintetici (60 allenamenti,
15 eventi di cronologia ciascuno, 2.400 prenotazioni):

| Operazione                        | Prima            | Dopo          |
| --------------------------------- | ---------------- | ------------- |
| Lettura completa per il team      | 17,7 MB, 18,5 s  | 0,7 MB, 63 ms |
| Salvataggio di una modifica       | oltre il timeout | 4 ms          |
| Aggiornamento dopo il focus       | lettura completa | 1,5 ms        |
| Lettura dell'area di uno studente | lettura completa | 67 KB, 7 ms   |

## Come funziona

**Versioni per record.** Ogni riga di `crm_students`, `crm_lessons`,
`crm_bookings`, `crm_assignments`, `crm_plans`, `crm_tiers`, `crm_properties`
e `crm_admins` ha `version` (cresce a ogni modifica) e `seq` (numero del
cambiamento globale in cui è stata scritta).

**Scritture a patch.** `crm_apply` riceve solo i record cambiati. Ogni record
indica la versione su cui si basa (`expected`): se nel frattempo è cambiato, la
scrittura fallisce con `PT409` solo per quel record. Modifiche a record diversi
non entrano mai in conflitto. Un blocco consultivo protegge la breve fase di
scrittura, così `seq` segue l'ordine di commit e chi ha letto fino a `n` ha
visto tutto fino a `n`.

**Capienza.** Due persone che prenotano l'ultimo posto validano sullo stesso
stato vecchio: la capienza si controlla quindi nel database, dentro il blocco,
con i conteggi reali (`capacity` in `crm_apply`).

**Letture a differenze.** `GET /api/crm` restituisce lo stato leggero con le
versioni; `GET /api/crm?since=<revisione>` solo i record cambiati (`crm_load_changes`)
e le rimozioni (`crm_tombstones`). Il browser tiene un cursore che avanza solo con
le letture: le risposte alle sue scritture contengono i soli record toccati.

**Dati pesanti a richiesta.** Allenamenti registrati, commenti e cronologia non
viaggiano con la lista. Si caricano quando si apre la scheda
(`GET /api/crm/studenti/[id]`); l'attività recente della home ha una lettura
propria (`/api/crm/attivita`). Gli allenamenti stanno nella colonna `heavy` di
`crm_students`, mai letta dalle liste.

**Area studente.** Uno studente legge solo la propria fetta (`crm_load_scope`):
la sua scheda completa, le sue prenotazioni, le lezioni future e i posti
occupati per lezione, senza i dati degli altri studenti.

## File

- `supabase/migrations/20261119090000_italfit_record_sync.sql`: colonne,
  indici, funzioni `crm_load*`, `crm_apply`, `crm_accept_access_v2`,
  `crm_link_access_v2`.
- `src/modules/crm/sync.ts`: differenze, patch, delta (puro, senza rete).
- `src/modules/crm/sync-projection.ts`: delta limitato a ciò che un membro vede.
- `src/modules/crm/server/repository.ts`: letture e `writeCrm` (diff + `crm_apply`).
- `src/modules/crm/server/staff-patch.ts`: la patch del browser diventa modifiche validate.
- `src/modules/crm/server/commands.ts`: comandi di studenti e team.
- `src/modules/crm/remote-adapter.ts`: store del browser (patch, delta, dettaglio).

## Cose da sapere

- I conflitti usano `PT409`, non `40001`: con `40001` PostgREST riprova fino al
  timeout del gateway (due minuti).
- La migrazione finale (`..._finish`) è applicata: gli allenamenti stanno nella
  colonna `heavy` e `crm_read`, `crm_write`, `crm_remove` non esistono più.
- Nelle liste lezioni e prenotazioni crescono senza limite: la prossima
  ottimizzazione è leggere solo una finestra recente (la contabilità dei mesi
  passati userebbe una lettura dedicata).
- I controlli tra record diversi (sovrapposizioni di orario) restano validati
  sullo stato letto: due scritture simultanee di lezioni sovrapposte sono
  improbabili ma non bloccate dal database.
