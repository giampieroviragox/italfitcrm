import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import {
  googleImagesUrl,
  isStructuralLabel,
  movements,
  movementsForName,
  searchTerm,
} from "../src/modules/crm/exercise-media.ts";

const one = (name) => movementsForName(name);

test("every movement has a generated image and vice versa", () => {
  const files = readdirSync("public/exercises")
    .filter((f) => f.endsWith(".svg"))
    .map((f) => f.replace(/\.svg$/, ""))
    .sort();
  assert.deepEqual(movements.map((m) => m.id).sort(), files);
  const animations = readdirSync("public/exercises/anim")
    .map((f) => f.replace(/\.svg$/, ""))
    .sort();
  assert.deepEqual(animations, files);
  const thumbs = readdirSync("public/exercises/thumbs")
    .map((f) => f.replace(/\.svg$/, ""))
    .sort();
  assert.deepEqual(thumbs, files);
});

test("names from the imported plans resolve to the right movement", () => {
  const cases = {
    "A1 · Back Squat": ["back-squat"],
    "A2 · Hollow Hold": ["hollow-hold"],
    "B1 · Push-up (o Panca Piana)": ["push-up", "bench-press"],
    "B2 · Inverted Row / Ring Row": ["inverted-row"],
    "C1 · Romanian Deadlift": ["romanian-deadlift"],
    "C2 · Reverse Lunge con manubri": ["reverse-lunge"],
    "Abductor machine – Mechanical drop": ["hip-abduction-machine"],
    "Alzate laterali al cavo (cavo dietro la schiena) – Parziali in allungamento":
      ["cable-lateral-raise"],
    "Blocco 1: Landmine press 8/8 + Cable row seduto 12": [
      "landmine-press",
      "seated-cable-row",
    ],
    "Blocco 2: Goblet squat a box 10 + Push-up 10-15": [
      "goblet-squat",
      "push-up",
    ],
    "Blocco 3: Farmer carry 30 m moderato + Pallof press 10/10": [
      "farmers-carry",
      "pallof-press",
    ],
    "Calf raise macchina – Stretch hold": ["calf-raise"],
    "Chest press macchina – serie pesanti": ["chest-press-machine"],
    "Croci ai cavi dal basso – FST-7": ["cable-fly-low"],
    "Curl manubri su panca inclinata": ["incline-dumbbell-curl"],
    "Dead bug lento": ["dead-bug"],
    "Estensioni sopra la testa al cavo": ["overhead-triceps-extension"],
    "Face pull": ["face-pull"],
    "Hack squat o belt squat": ["hack-squat"],
    "Hammer curl al cavo con corda": ["cable-curl"],
    'Hip thrust macchina – Pausa 2" in alto': ["hip-thrust"],
    "Lat machine presa neutra – Pausa in allungamento": ["lat-pulldown"],
    "Leg curl seduto – Myo-reps": ["leg-curl-seated"],
    "Leg extension – pre-esaurimento": ["leg-extension"],
    "Leg press": ["leg-press"],
    "Military press seduto con schienale (bilanciere o multipower)": [
      "shoulder-press",
    ],
    "Panca inclinata manubri – 1¼ reps": ["incline-dumbbell-press"],
    "Panca piana bilanciere": ["bench-press"],
    "Plank RKC": ["plank"],
    "Pulldown unilaterale in ginocchio – Iso-hold": ["kneeling-pulldown"],
    "Pullover al cavo": ["cable-pullover"],
    "Pushdown corda": ["triceps-pushdown"],
    "Reverse pec deck – Doppio drop": ["reverse-pec-deck"],
    "Row chest-supported – post-esaurimento": ["chest-supported-row"],
    "Shoulder press macchina – Cluster": ["shoulder-press"],
    "Side plank con reach sotto": ["side-plank"],
    "Split squat al multipower – Tempo 3-1-1": ["split-squat"],
    "Stacco rumeno manubri – leggero": ["romanian-deadlift"],
    "Suitcase hold manubrio": ["suitcase-hold"],
    "Trazioni alla sbarra (assistite se serve)": ["pull-up"],
    "21s al cavo": ["cable-curl"],
    "Corsa easy": ["corsa"],
    "Strides finali": ["corsa"],
    "1000 m": ["corsa"],
    "4 × 400 m": ["corsa"],
  };
  for (const [name, expected] of Object.entries(cases)) {
    assert.deepEqual(one(name), expected, name);
  }
});

test("blocks, phases and unknown names have no figure", () => {
  for (const name of [
    "Avvio · 10′",
    "Blocco 1",
    "Chiusura · 5′",
    "Parte 1",
    "",
    "Esercizio nuovo",
  ]) {
    assert.deepEqual(one(name), [], name);
  }
});

test("every suggested name resolves to its own movement", () => {
  for (const m of movements) {
    assert.ok(one(m.label).includes(m.id), `${m.label} -> ${m.id}`);
  }
});

test("block labels are recognised as structural", () => {
  for (const name of [
    "Blocco 2",
    "Avvio · 10′",
    "Chiusura · 5′",
    "Sweet spot",
    "Circuito Hyrox finale",
  ]) {
    assert.equal(isStructuralLabel(name), true, name);
  }
  assert.equal(isStructuralLabel("Leg press"), false);
});

test("search links use the exercise name without technique notes", () => {
  assert.equal(searchTerm("Leg curl seduto – Myo-reps"), "Leg curl seduto");
  assert.equal(searchTerm("A1 · Back Squat"), "Back Squat");
  assert.equal(
    searchTerm("Alzate laterali al cavo (cavo dietro la schiena) – Parziali"),
    "Alzate laterali al cavo",
  );
  assert.equal(
    googleImagesUrl("Leg press – 4 serie"),
    "https://www.google.com/search?tbm=isch&q=Leg%20press%20esercizio",
  );
});
