// Generates the exercise illustrations as static SVG files.
// Usage: pnpm exercises:build   (writes public/exercises/<id>.svg)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderAnimated, renderExercise, renderThumb } from "./engine.mjs";
import { exercises as e1 } from "./exercises.mjs";
import { exercises2 } from "./exercises2.mjs";
import { exercises3 } from "./exercises3.mjs";

export const allExercises = [...e1, ...exercises2, ...exercises3];

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "public", "exercises");
mkdirSync(join(outDir, "thumbs"), { recursive: true });
mkdirSync(join(outDir, "anim"), { recursive: true });
for (const ex of allExercises) {
  writeFileSync(join(outDir, `${ex.id}.svg`), `${renderExercise(ex)}\n`);
  writeFileSync(
    join(outDir, "anim", `${ex.id}.svg`),
    `${renderAnimated(ex)}\n`,
  );
  writeFileSync(join(outDir, "thumbs", `${ex.id}.svg`), `${renderThumb(ex)}\n`);
}
console.log(`${allExercises.length} illustrazioni scritte in public/exercises`);
