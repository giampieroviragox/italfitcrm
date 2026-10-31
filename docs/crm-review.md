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

## Confine della verifica

È ancora un prototipo locale senza autenticazione o Supabase. Le revisioni proteggono i form aperti ma non sostituiscono le transazioni e l’autorizzazione di un database. La cronologia delle schede precedenti parte dalla prima modifica effettuata con questa versione. Non sono stati implementati allenamenti, prenotazioni o regole di accesso per tier.
