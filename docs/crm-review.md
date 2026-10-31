# Revisione CRM · 31 ottobre 2026

## Correzioni principali

- Le viste e la configurazione corrente dell’elenco sopravvivono a navigazione e ricaricamento. I nomi sono univoci, con il nome della vista predefinita riservato.
- Filtri tipizzati combinati in AND; campo vuoto distinto da zero e No. Ricerche nei soli campi attivi, compresi coach, tag e nome del tier.
- Colonne, ordinamento stabile e paginazione; selezioni mantenute tra pagine e azzerate al cambio dei filtri. Azioni massive validate prima di scrivere il payload.
- Note e cronologia, revisione dei record, conferma di scarto dei form, controllo dei salvataggi basati su schede superate.
- Archiviazione senza cancellazione di dati. Gli archiviati non entrano nei conteggi Home; il ripristino richiede un tier disponibile.
- Proprietà archiviate escluse da ricerca, filtri e colonne. La conferma spiega l’effetto sulle viste; i valori rimangono nelle schede e ricompaiono al ripristino della proprietà.
- Validazione di date reali, opzioni univoche anche rispetto a spazi e maiuscole, email duplicate e riferimenti ai tier. Il caricamento controlla anche la coerenza del contenuto locale, senza sovrascrivere dati corrotti.
- Backup JSON dalle impostazioni e possibilità di riprovare la lettura dell’archivio locale.

## Verifica

La suite copre confronti numerici/date, booleani, filtri multiselezione, ricerca, ordinamento, archiviazione, transizioni massive, vincoli sulle proprietà e schema di persistenza. I controlli di progetto comprendono ESLint, TypeScript strict e Prettier, oltre alla build di produzione.

Verificati con Computer Use: creazione e ricaricamento di una vista, filtro multiselezione con colonna personalizzata, cambio massivo dello stato di due studenti e ripristino, note persistenti, archiviazione/ripristino di una scheda, cronologia, conferma di scarto e rilevamento di un conflitto tra due finestre aperte sulla stessa scheda.

## Evoluzione del progetto

Questa revisione era stata eseguita sul primo adapter locale. Il progetto è ora collegato a Supabase, con autenticazione, permessi, RLS e transazioni versionate. Piani e prenotazioni sono implementati. Le prove successive sono in [verification.md](verification.md); gli standard della revisione finale sono in [quality-plan.md](quality-plan.md). Le regole di accesso ai contenuti per tier restano da definire esplicitamente.
