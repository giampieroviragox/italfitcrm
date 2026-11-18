// Side-view mannequin drawn from joint angles. Figure faces right.
// Angles in degrees, screen coordinates: 0 = right, 90 = down, 180 = left, -90 = up.
export const COLORS = {
  bg: "#f2f4f5",
  panel: "#ffffff",
  ground: "#cfd5d8",
  body: "#2b2f33",
  far: "#8d979d",
  hl: "#f62f2f",
  gear: "#9aa3a8",
  gearDark: "#5f696f",
  line: "#d7dcdf",
};

const L = {
  torso: 76,
  neck: 17,
  head: 13,
  thigh: 58,
  shin: 57,
  foot: 21,
  ua: 42,
  fa: 40,
};
const rad = (a) => (a * Math.PI) / 180;
const dir = (a) => [Math.cos(rad(a)), Math.sin(rad(a))];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const f = (n) => Math.round(n * 10) / 10;

/** Two-link IK. bend = +1 puts the middle joint on the clockwise side. */
export function ik(root, target, l1, l2, bend = 1) {
  let d = dist(root, target);
  const max = l1 + l2 - 0.01;
  let t = target;
  if (d > max) {
    const k = max / d;
    t = [
      root[0] + (target[0] - root[0]) * k,
      root[1] + (target[1] - root[1]) * k,
    ];
    d = max;
  }
  const a = Math.atan2(t[1] - root[1], t[0] - root[0]);
  const cosA = Math.max(
    -1,
    Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)),
  );
  const ang = a + bend * Math.acos(cosA);
  const mid = [root[0] + l1 * Math.cos(ang), root[1] + l1 * Math.sin(ang)];
  return { mid, end: t };
}

/**
 * pose: {
 *   hip: [x,y] (relative), torso: angle, head?: angle,
 *   leg: {thigh,shin,foot} | {ankle:[dx,dy] from hip, foot, bend},
 *   arm: {ua,fa} | {wrist:[dx,dy] from shoulder, bend},
 *   far?: {leg?, arm?}  // optional different far-side limbs
 * }
 */
export function solve(pose) {
  const hip = pose.hip ?? [0, 0];
  const tv = dir(pose.torso);
  const neck = add(hip, mul(tv, L.torso));
  const shoulder = add(hip, mul(tv, L.torso * 0.9));
  const headC = add(neck, mul(dir(pose.head ?? pose.torso), L.neck));
  const legOf = (leg) => {
    let knee, ankle;
    if (leg.ankle) {
      const r = ik(hip, add(hip, leg.ankle), L.thigh, L.shin, leg.bend ?? 1);
      knee = r.mid;
      ankle = r.end;
    } else {
      knee = add(hip, mul(dir(leg.thigh), L.thigh));
      ankle = add(knee, mul(dir(leg.shin), L.shin));
    }
    const toe = add(ankle, mul(dir(leg.foot ?? 0), L.foot));
    return { knee, ankle, toe };
  };
  const armOf = (arm) => {
    let elbow, wrist;
    if (arm.wrist) {
      const r = ik(
        shoulder,
        add(shoulder, arm.wrist),
        L.ua,
        L.fa,
        arm.bend ?? 1,
      );
      elbow = r.mid;
      wrist = r.end;
    } else {
      elbow = add(shoulder, mul(dir(arm.ua), L.ua));
      wrist = add(elbow, mul(dir(arm.fa), L.fa));
    }
    return { elbow, wrist };
  };
  const near = { ...legOf(pose.leg), ...armOf(pose.arm) };
  const far = {
    ...legOf(pose.far?.leg ?? pose.leg),
    ...armOf(pose.far?.arm ?? pose.arm),
  };
  return { hip, neck, shoulder, headC, near, far, tv };
}

const seg = (a, b, w, color) =>
  `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;

const halo = (a, b, w) => seg(a, b, w + 5, "#ffffff");

/** Draws mannequin. hl: names of highlighted parts. Returns svg string (absolute coords). */
export function drawFigure(J, hl = []) {
  const c = (name, base) => (hl.includes(name) ? COLORS.hl : base);
  const out = [];
  // far-side limbs, lighter, behind
  const fr = { dx: -5, dy: 0 };
  const sh = (p) => [p[0] + fr.dx, p[1] + fr.dy];
  out.push(seg(sh(J.hip), sh(J.far.knee), 10, COLORS.far));
  out.push(seg(sh(J.far.knee), sh(J.far.ankle), 9, COLORS.far));
  out.push(seg(sh(J.far.ankle), sh(J.far.toe), 7, COLORS.far));
  out.push(seg(sh(J.shoulder), sh(J.far.elbow), 8, COLORS.far));
  out.push(seg(sh(J.far.elbow), sh(J.far.wrist), 7, COLORS.far));
  // torso
  const tcol = c("torso", COLORS.body);
  out.push(seg(J.hip, J.neck, 18, tcol));
  const chest = [
    J.hip[0] + (J.neck[0] - J.hip[0]) * 0.8,
    J.hip[1] + (J.neck[1] - J.hip[1]) * 0.8,
  ];
  out.push(
    `<circle cx="${f(chest[0])}" cy="${f(chest[1])}" r="13" fill="${tcol}"/>`,
  );
  out.push(
    `<circle cx="${f(J.hip[0])}" cy="${f(J.hip[1])}" r="11" fill="${hl.includes("glute") ? COLORS.hl : tcol}"/>`,
  );
  // near legs
  out.push(
    halo(J.hip, J.near.knee, 12) +
      seg(J.hip, J.near.knee, 12, c("thigh", COLORS.body)),
  );
  out.push(
    halo(J.near.knee, J.near.ankle, 10) +
      seg(J.near.knee, J.near.ankle, 10, c("shin", COLORS.body)),
  );
  out.push(seg(J.near.ankle, J.near.toe, 8, COLORS.body));
  // head
  out.push(
    `<circle cx="${f(J.headC[0])}" cy="${f(J.headC[1])}" r="${L.head}" fill="${COLORS.body}"/>`,
  );
  // near arm
  out.push(
    halo(J.shoulder, J.near.elbow, 9) +
      seg(J.shoulder, J.near.elbow, 9, c("arm", COLORS.body)),
  );
  out.push(
    halo(J.near.elbow, J.near.wrist, 8) +
      seg(J.near.elbow, J.near.wrist, 8, c("forearm", COLORS.body)),
  );
  out.push(
    `<circle cx="${f(J.near.wrist[0])}" cy="${f(J.near.wrist[1])}" r="4.5" fill="${COLORS.body}"/>`,
  );
  return out.join("");
}

export const PANEL = { w: 360, h: 300, ground: 268 };

// ---------- front view ----------
/**
 * pose: { hip, torso (default -90), sw, hw,
 *   legs: {l:{thigh,shin,tl?}, r:{...}}, arms: {l:{ua,fa,ul?,fl?}, r:{...}} }
 * l = viewer's left, r = viewer's right.
 */
export function solveFront(pose) {
  const hip = pose.hip ?? [0, 0];
  const t = pose.torso ?? -90;
  const tv = dir(t),
    pv = dir(t + 90);
  const SW = pose.sw ?? 21,
    HW = pose.hw ?? 11;
  const neck = add(hip, mul(tv, L.torso));
  const shC = add(hip, mul(tv, L.torso * 0.9));
  const headC = add(neck, mul(tv, L.neck));
  const sides = {};
  for (const [k, s] of [
    ["l", -1],
    ["r", 1],
  ]) {
    const shoulder = add(shC, mul(pv, s * SW));
    const hj = add(hip, mul(pv, s * HW));
    const lg = pose.legs[k];
    const knee = add(hj, mul(dir(lg.thigh), L.thigh * (lg.tl ?? 1)));
    const ankle = add(knee, mul(dir(lg.shin), L.shin * (lg.sl ?? 1)));
    const toe = add(ankle, [s * 12, 3]);
    const ar = pose.arms[k];
    const elbow = add(shoulder, mul(dir(ar.ua), L.ua * (ar.ul ?? 1)));
    const wrist = add(elbow, mul(dir(ar.fa), L.fa * (ar.fl ?? 1)));
    sides[k] = { shoulder, hj, knee, ankle, toe, elbow, wrist };
  }
  return { hip, neck, headC, shC, sides, tv };
}

export function drawFront(J, hl = []) {
  const c = (name) => (hl.includes(name) ? COLORS.hl : COLORS.body);
  const out = [];
  const { l, r } = J.sides;
  for (const S of [l, r]) {
    out.push(halo(S.hj, S.knee, 12) + seg(S.hj, S.knee, 12, c("thigh")));
    out.push(halo(S.knee, S.ankle, 10) + seg(S.knee, S.ankle, 10, c("shin")));
    out.push(seg(S.ankle, S.toe, 7, COLORS.body));
  }
  const tcol = c("torso");
  out.push(seg(J.hip, J.neck, 20, tcol));
  out.push(seg(l.hj, r.hj, 14, hl.includes("glute") ? COLORS.hl : tcol));
  out.push(seg(l.shoulder, r.shoulder, 13, tcol));
  out.push(
    `<circle cx="${f(J.headC[0])}" cy="${f(J.headC[1])}" r="${L.head}" fill="${COLORS.body}"/>`,
  );
  for (const S of [l, r]) {
    out.push(
      halo(S.shoulder, S.elbow, 9) + seg(S.shoulder, S.elbow, 9, c("arm")),
    );
    out.push(
      halo(S.elbow, S.wrist, 8) + seg(S.elbow, S.wrist, 8, c("forearm")),
    );
    out.push(
      `<circle cx="${f(S.wrist[0])}" cy="${f(S.wrist[1])}" r="4.5" fill="${COLORS.body}"/>`,
    );
  }
  return out.join("");
}

const mapPts = (o, T) =>
  Array.isArray(o) && o.length === 2 && typeof o[0] === "number"
    ? T(o)
    : Array.isArray(o)
      ? o.map((x) => mapPts(x, T))
      : o && typeof o === "object"
        ? Object.fromEntries(
            Object.entries(o).map(([k, v]) => [k, mapPts(v, T)]),
          )
        : o;

/**
 * Renders one panel. frame spec:
 *  { view?: 'side'|'front', pose, gear(J, ctx), gearFront?(J, ctx),
 *    contact: ['feet','far','hands','knees','hip'] | null, anchorX, anchor: 'ankle', hipAbs, flip }
 */
export function renderFrame(spec, hl) {
  const front = spec.view === "front";
  const J0 = front ? solveFront(spec.pose) : solve(spec.pose);
  const pointsFor = (k) => {
    if (front) {
      const { l, r } = J0.sides;
      if (k === "feet")
        return [l.toe[1], r.toe[1], l.ankle[1] + 5, r.ankle[1] + 5];
      return [];
    }
    const n = J0.near,
      fr = J0.far;
    if (k === "feet") return [n.toe[1], n.ankle[1] + 6];
    if (k === "far") return [fr.toe[1], fr.ankle[1] + 6];
    if (k === "hands") return [n.wrist[1] + 5];
    if (k === "knees") return [n.knee[1] + 6];
    if (k === "farknee") return [fr.knee[1] + 6];
    if (k === "hip") return [J0.hip[1] + 12];
    return [];
  };
  let dy = 0;
  if (spec.contact !== null) {
    const pts = (spec.contact ?? ["feet"]).flatMap(pointsFor);
    dy = PANEL.ground - Math.max(...pts);
  }
  const ref = front ? J0.sides.l.ankle : J0.near.ankle;
  let dx = (spec.anchorX ?? 180) - J0.hip[0];
  if (spec.anchor === "ankle") dx = (spec.anchorX ?? 180) - ref[0];
  if (spec.hipAbs) {
    dx = spec.hipAbs[0] - J0.hip[0];
    dy = spec.hipAbs[1] - J0.hip[1];
  }
  const T = (p) => [p[0] + dx, p[1] + dy];
  const J = mapPts(J0, T);
  const ctx = { ground: PANEL.ground, dx, dy };
  const back = spec.gear ? spec.gear(J, ctx) : "";
  const fgear = spec.gearFront ? spec.gearFront(J, ctx) : "";
  const scene = back + (front ? drawFront(J, hl) : drawFigure(J, hl)) + fgear;
  const body = spec.flip
    ? `<g transform="translate(${PANEL.w},0) scale(-1,1)">${scene}</g>`
    : scene;
  return (
    `<line x1="30" y1="${PANEL.ground + 4}" x2="${PANEL.w - 30}" y2="${PANEL.ground + 4}" stroke="${COLORS.ground}" stroke-width="3" stroke-linecap="round"/>` +
    body
  );
}

export function renderExercise(ex) {
  const w = PANEL.w * ex.frames.length + 20 * (ex.frames.length - 1);
  const parts = ex.frames.map((fr, i) => {
    const x = i * (PANEL.w + 20);
    return `<g transform="translate(${x},0)"><rect width="${PANEL.w}" height="${PANEL.h}" rx="16" fill="${COLORS.panel}"/>${renderFrame(fr, ex.hl)}</g>`;
  });
  const arrow =
    ex.frames.length < 2
      ? ""
      : `<path d="M${PANEL.w - 4} ${PANEL.h / 2} h28 m-8 -8 l8 8 l-8 8" fill="none" stroke="${COLORS.gearDark}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${PANEL.h}" width="${w}" height="${PANEL.h}" role="img" aria-label="${ex.label}">` +
    `<rect width="${w}" height="${PANEL.h}" rx="18" fill="${COLORS.bg}"/>${parts.join("")}${arrow}</svg>`
  );
}

/** Bounding box of drawn shapes (ground line excluded), in panel coordinates. */
function bboxOf(fragment, flip) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  const take = (x, y, r = 0) => {
    const xs = flip ? PANEL.w - x : x;
    x0 = Math.min(x0, xs - r);
    x1 = Math.max(x1, xs + r);
    y0 = Math.min(y0, y - r);
    y1 = Math.max(y1, y + r);
  };
  const body = fragment.replace(/^<line[^>]*\/>/, "");
  for (const m of body.matchAll(
    /<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)" stroke="[^"]*" stroke-width="([\d.]+)"/g,
  )) {
    const r = Number(m[5]) / 2;
    take(Number(m[1]), Number(m[2]), r);
    take(Number(m[3]), Number(m[4]), r);
  }
  for (const m of body.matchAll(
    /<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g,
  ))
    take(Number(m[1]), Number(m[2]), Number(m[3]));
  for (const m of body.matchAll(
    /<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g,
  )) {
    take(Number(m[1]), Number(m[2]));
    take(Number(m[1]) + Number(m[3]), Number(m[2]) + Number(m[4]));
  }
  return { x0, y0, x1, y1 };
}

/** Square-ish close-up of the last frame, cropped around the figure and gear. */
export function renderThumb(ex) {
  const fr = ex.frames[ex.frames.length - 1];
  const frag = renderFrame(fr, ex.hl);
  const b = bboxOf(frag, !!fr.flip);
  const pad = 14,
    ratio = 6 / 5;
  let w = b.x1 - b.x0 + pad * 2,
    h = b.y1 - b.y0 + pad * 2;
  if (w / h < ratio) w = h * ratio;
  else h = w / ratio;
  const cx = (b.x0 + b.x1) / 2,
    cy = (b.y0 + b.y1) / 2;
  const vb = [cx - w / 2, cy - h / 2, w, h]
    .map((n) => Math.round(n * 10) / 10)
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="120" height="100" role="img" aria-label="${ex.label}"><rect x="-1000" y="-1000" width="3000" height="3000" fill="#ffffff"/>${frag}</svg>`;
}

// ---------- animation between the first and last frame ----------
const SCALE_KEYS = new Set(["tl", "sl", "ul", "fl"]);
const SNAP_KEYS = new Set(["bend"]);
const ANGLE_KEYS = new Set([
  "torso",
  "head",
  "thigh",
  "shin",
  "foot",
  "ua",
  "fa",
]);
const lerp = (a, b, t) => a + (b - a) * t;

function mix(a, b, t, key) {
  if (typeof a === "number" && typeof b === "number") {
    if (SNAP_KEYS.has(key)) return t < 0.5 ? a : b;
    // Angles turn the short way round (-90 to 190 is 80 degrees, not 280).
    if (ANGLE_KEYS.has(key))
      return a + (((((b - a + 540) % 360) + 360) % 360) - 180) * t;
    return lerp(a, b, t);
  }
  if (Array.isArray(a) && Array.isArray(b))
    return a.map((v, i) => mix(v, b[i], t));
  if (a && b && typeof a === "object" && typeof b === "object") {
    // A limb built from angles and one built from a target cannot be blended.
    if ("ankle" in a !== "ankle" in b || "wrist" in a !== "wrist" in b)
      return t < 0.5 ? a : b;
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const av = k in a ? a[k] : SCALE_KEYS.has(k) ? 1 : undefined;
      const bv = k in b ? b[k] : SCALE_KEYS.has(k) ? 1 : undefined;
      out[k] =
        av === undefined || bv === undefined
          ? t < 0.5
            ? av
            : bv
          : mix(av, bv, t, k);
    }
    return out;
  }
  return t < 0.5 ? a : b;
}

const withHead = (pose) =>
  pose.torso !== undefined || pose.head !== undefined
    ? { ...pose, head: pose.head ?? pose.torso }
    : pose;

/** The frame spec between two frames; t = 0 is `a`, t = 1 is `b`. */
export function blendFrames(a, b, t) {
  const contact =
    a.contact === null || b.contact === null
      ? null
      : [...new Set([...(a.contact ?? ["feet"]), ...(b.contact ?? ["feet"])])];
  const spec = {
    ...a,
    contact,
    pose: mix(withHead(a.pose), withHead(b.pose), t),
  };
  if (a.hipAbs && b.hipAbs) spec.hipAbs = mix(a.hipAbs, b.hipAbs, t);
  if (a.anchorX !== undefined && b.anchorX !== undefined)
    spec.anchorX = lerp(a.anchorX, b.anchorX, t);
  return spec;
}

/**
 * One panel that moves from the first to the last pose and back, holding at both
 * ends. Plain CSS animation inside the SVG, so it also runs inside an <img>.
 * With reduced motion it shows the last pose and stands still.
 */
export function renderAnimated(ex, { steps = 8, seconds = 3.6 } = {}) {
  const first = ex.frames[0],
    last = ex.frames[ex.frames.length - 1];
  if (ex.frames.length < 2)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PANEL.w} ${PANEL.h}" width="${PANEL.w}" height="${PANEL.h}" role="img" aria-label="${ex.label}"><rect width="${PANEL.w}" height="${PANEL.h}" rx="16" fill="${COLORS.panel}"/>${renderFrame(first, ex.hl)}</svg>`;
  const groups = [];
  for (let i = 0; i < steps; i++) {
    const spec = blendFrames(first, last, i / (steps - 1));
    groups.push(`<g class="f f${i}">${renderFrame(spec, ex.hl)}</g>`);
  }
  const hold = 3;
  const seq = [
    ...Array(hold).fill(0),
    ...Array.from({ length: steps - 2 }, (_, i) => i + 1),
    ...Array(hold).fill(steps - 1),
    ...Array.from({ length: steps - 2 }, (_, i) => steps - 2 - i),
  ];
  const n = seq.length;
  const css = [];
  for (let i = 0; i < steps; i++) {
    const stops = seq.map(
      (v, s) => `${((s * 100) / n).toFixed(3)}%{opacity:${v === i ? 1 : 0}}`,
    );
    stops.push(`100%{opacity:${seq[0] === i ? 1 : 0}}`);
    css.push(`@keyframes k${i}{${stops.join("")}}.f${i}{animation-name:k${i}}`);
  }
  const style = `.f{opacity:0;animation-duration:${seconds}s;animation-iteration-count:infinite;animation-timing-function:step-end}${css.join("")}@media (prefers-reduced-motion:reduce){.f{animation:none}.f${steps - 1}{opacity:1}}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PANEL.w} ${PANEL.h}" width="${PANEL.w}" height="${PANEL.h}" role="img" aria-label="${ex.label}"><style>${style}</style><rect width="${PANEL.w}" height="${PANEL.h}" rx="16" fill="${COLORS.panel}"/>${groups.join("")}</svg>`;
}

// ---------- gear primitives ----------
export const gear = {
  plate: (p, r = 22) =>
    `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r}" fill="${COLORS.gear}"/><circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r * 0.45}" fill="${COLORS.gearDark}"/>`,
  dumbbellV: (p, len = 34) =>
    `<line x1="${f(p[0])}" y1="${f(p[1] - len / 2)}" x2="${f(p[0])}" y2="${f(p[1] + len / 2)}" stroke="${COLORS.gearDark}" stroke-width="6" stroke-linecap="round"/>` +
    `<circle cx="${f(p[0])}" cy="${f(p[1] - len / 2)}" r="9" fill="${COLORS.gear}"/><circle cx="${f(p[0])}" cy="${f(p[1] + len / 2)}" r="9" fill="${COLORS.gear}"/>`,
  dumbbellEnd: (p, r = 10) =>
    `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r}" fill="${COLORS.gear}"/><circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r * 0.4}" fill="${COLORS.gearDark}"/>`,
  rect: (x, y, w, h, fill = COLORS.gear, rx = 4) =>
    `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${rx}" fill="${fill}"/>`,
  line: (a, b, w = 4, color = COLORS.gearDark) => seg(a, b, w, color),
  circle: (p, r, fill = COLORS.gearDark) =>
    `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r}" fill="${fill}"/>`,
};
