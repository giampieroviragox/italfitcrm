# Illustrazioni degli esercizi

Ogni esercizio dei piani può mostrare un disegno schematico con la posizione di
partenza e di arrivo. I muscoli che lavorano sono in rosso. Le figure sono tutte
dello stesso stile perché nascono dallo stesso manichino, quindi non hanno
licenze da citare.

## Dove sta cosa

- `tools/exercise-illustrations/`: il generatore. `engine.mjs` disegna il
  manichino (vista laterale e frontale) da pochi angoli, `exercises*.mjs`
  contengono i movimenti.
- `public/exercises/<id>.svg`: figura a due momenti. `public/exercises/anim/`:
  lo stesso movimento animato (8 pose intermedie tra partenza e arrivo, andata e
  ritorno, con una pausa a ciascun estremo; con «riduci animazioni» resta ferma
  sull'arrivo). `public/exercises/thumbs/`: ritaglio dell'ultimo momento per le
  liste. Sono file generati: si
  rigenerano con `pnpm exercises:build` e si committano.
- `src/modules/crm/exercise-media.ts`: elenco dei movimenti e regole che
  collegano il nome di un esercizio ai disegni (per esempio «Leg curl seduto –
  Myo-reps» e «Leg curl» mostrano lo stesso disegno). Un nome può rimandare a
  più disegni: «Blocco 1: Landmine press + Cable row seduto».
- `src/modules/crm/exercise-media-view.tsx`: miniatura con pannello di dettaglio
  (liste dei piani) e figura grande (passaggio dell'allenamento dello studente).

## Cosa vede lo studente

Miniatura accanto a ogni esercizio. Nel passaggio dell'allenamento la figura si
muove in loop. Al tocco della miniatura si apre il pannello con il movimento
animato, la partenza e l'arrivo affiancati e due
collegamenti: ricerca su Google Immagini e su YouTube, già impostata sul nome
dell'esercizio senza le note tecniche. Se il coach ha inserito un link video, compare
come «Video del coach». I nomi senza disegno (e che non sono etichette come
«Blocco 1» o «Chiusura») mostrano solo il collegamento a Google Immagini.

## Aggiungere un movimento

1. Aggiungere il movimento in `tools/exercise-illustrations/exercises*.mjs`:
   due momenti, ciascuno con la posa (angoli in gradi, 0 = destra, 90 = giù) e
   l'attrezzo.
2. Aggiungerlo a `movements` e a `rules` in `exercise-media.ts`.
3. `pnpm exercises:build`, guardare le immagini, poi `pnpm test`: il test
   controlla che ogni movimento abbia sia il disegno sia la miniatura.

## Perché non una libreria di foto

Valutate libreria wger (licenze Creative Commons con autore da citare, stili
misti tra foto e disegni) e free-exercise-db (l'autore dichiara di non conoscere
la provenienza delle immagini). Google Immagini non si può incorporare: l'API di
ricerca immagini è chiusa ai nuovi clienti e verrà spenta il 1 gennaio 2027.
Restano il collegamento di ricerca e i disegni propri.

## Limiti

Sono pittogrammi: mostrano posizione e attrezzo, non dettagli di tecnica come
larghezza della presa. Pallof press è disegnato di profilo con il cavo in
primo piano, e alcune pose (row con appoggio sul petto, hip thrust) sono le
meno curate.

## Per il coach

Nell'editor del piano il campo del nome propone i movimenti che hanno un disegno e,
sotto, mostra quale disegno ottiene il nome scritto (o avvisa che non ce n'è). Un
nome libero funziona comunque: se contiene un movimento noto, ottiene il suo
disegno.
