import { gear, COLORS } from "./engine.mjs";

const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const dir = (a) => [
  Math.cos((a * Math.PI) / 180),
  Math.sin((a * Math.PI) / 180),
];
const mul = (v, k) => [v[0] * k, v[1] * k];
const G = 268;
const stand = { thigh: 90, shin: 90, foot: 0 };

// seated machine furniture: seat, backrest, post
const seat = (J, back = true) =>
  gear.rect(J.hip[0] - 26, J.hip[1] + 12, 62, 9, COLORS.gear, 4) +
  gear.line([J.hip[0] + 4, J.hip[1] + 21], [J.hip[0] + 4, G + 4], 6) +
  (back
    ? gear.line(
        [J.hip[0] - 18, J.hip[1] + 8],
        [J.hip[0] - 26, J.hip[1] - 92],
        11,
        COLORS.gear,
      )
    : "");

const seatedLegs = { thigh: -2, shin: 92, foot: 0 };

export const exercises3 = [
  (() => {
    const cable = (J) => {
      const wr = J.near.wrist;
      const col = 44;
      return (
        gear.line([col, G + 4], [col, 60], 8, COLORS.gear) +
        gear.line([col, wr[1] + 30], wr, 2.5) +
        gear.circle([col, wr[1] + 30], 6, COLORS.gearDark)
      );
    };
    return {
      id: "pallof-press",
      label: "Pallof press",
      hl: ["torso", "arm"],
      frames: [
        {
          anchor: "ankle",
          anchorX: 190,
          pose: { torso: -90, leg: stand, arm: { wrist: [24, 6], bend: 1 } },
          gear: cable,
        },
        {
          anchor: "ankle",
          anchorX: 190,
          pose: { torso: -90, leg: stand, arm: { wrist: [80, 6], bend: 1 } },
          gear: cable,
        },
      ],
    };
  })(),
  (() => {
    const row = (J) => {
      const ax = J.near.ankle[0],
        ay = J.near.ankle[1];
      const px = ax + 70,
        py = G - 52;
      return (
        gear.rect(J.hip[0] - 30, J.hip[1] + 12, 64, 9, COLORS.gear, 4) +
        gear.line([J.hip[0], J.hip[1] + 21], [J.hip[0], G + 4], 6) +
        gear.rect(ax + 6, ay - 34, 9, 62, COLORS.gear, 3) +
        gear.line([px, py], J.near.wrist, 2.5) +
        gear.circle([px, py], 8, COLORS.gear) +
        gear.circle([px, py], 3) +
        gear.line([px + 16, py + 20], [px + 16, G + 4], 6) +
        gear.circle(J.near.wrist, 6, COLORS.gearDark)
      );
    };
    const f = (torso, wrist) => ({
      hipAbs: [140, 226],
      pose: {
        torso,
        head: torso,
        leg: { ankle: [110, 14], foot: -80, bend: -1 },
        arm: { wrist, bend: 1 },
      },
      contact: null,
      gear: row,
    });
    return {
      id: "seated-cable-row",
      label: "Rematore al cavo seduto",
      hl: ["torso", "arm"],
      frames: [f(-70, [78, 12]), f(-96, [22, 36])],
    };
  })(),
  (() => {
    const press = (J) =>
      seat(J) +
      gear.line(
        [J.hip[0] + 124, J.shoulder[1] - 6],
        J.near.wrist,
        5,
        COLORS.gear,
      ) +
      gear.line(
        [J.hip[0] + 124, J.shoulder[1] - 6],
        [J.hip[0] + 124, G + 4],
        6,
      ) +
      gear.circle(J.near.wrist, 7, COLORS.gearDark);
    const f = (wrist) => ({
      anchorX: 130,
      pose: { torso: -95, head: -95, leg: seatedLegs, arm: { wrist, bend: 1 } },
      contact: ["feet"],
      gear: press,
    });
    return {
      id: "chest-press-machine",
      label: "Chest press",
      hl: ["torso", "arm"],
      frames: [f([26, 6]), f([81, 2])],
    };
  })(),
  (() => {
    const cables = (J) => {
      const l = J.sides.l.wrist,
        r = J.sides.r.wrist;
      return (
        gear.line([34, G + 4], [34, 60], 8, COLORS.gear) +
        gear.line([326, G + 4], [326, 60], 8, COLORS.gear) +
        gear.line([34, G - 8], l, 2.5) +
        gear.line([326, G - 8], r, 2.5) +
        gear.circle([34, G - 8], 6) +
        gear.circle([326, G - 8], 6)
      );
    };
    const legs = { l: { thigh: 96, shin: 94 }, r: { thigh: 84, shin: 86 } };
    return {
      id: "cable-fly-low",
      label: "Croci ai cavi dal basso",
      hl: ["torso", "arm"],
      frames: [
        {
          view: "front",
          anchorX: 180,
          pose: {
            torso: -90,
            legs,
            arms: { l: { ua: 128, fa: 128 }, r: { ua: 52, fa: 52 } },
          },
          gear: cables,
        },
        {
          view: "front",
          anchorX: 180,
          pose: {
            torso: -90,
            legs,
            arms: { l: { ua: 120, fa: -30 }, r: { ua: 60, fa: -150 } },
          },
          gear: cables,
        },
      ],
    };
  })(),
  (() => {
    const cable = (J) =>
      gear.line([30, G - 8], J.sides.r.wrist, 2.5) +
      gear.circle([30, G - 8], 6) +
      gear.line([30, G + 4], [30, 90], 8, COLORS.gear);
    const legs = { l: { thigh: 96, shin: 94 }, r: { thigh: 84, shin: 86 } };
    return {
      id: "cable-lateral-raise",
      label: "Alzate laterali al cavo",
      hl: ["arm"],
      frames: [
        {
          view: "front",
          anchorX: 190,
          pose: {
            torso: -90,
            legs,
            arms: { l: { ua: 92, fa: 92 }, r: { ua: 68, fa: 80 } },
          },
          gearFront: cable,
        },
        {
          view: "front",
          anchorX: 190,
          pose: {
            torso: -90,
            legs,
            arms: { l: { ua: 92, fa: 92 }, r: { ua: 2, fa: -4 } },
          },
          gearFront: cable,
        },
      ],
    };
  })(),
  (() => {
    const deck = (J) =>
      gear.rect(J.hip[0] - 34, J.hip[1] + 10, 68, 9, COLORS.gear, 4) +
      gear.line([J.hip[0], J.hip[1] + 19], [J.hip[0], G + 4], 6);
    const hands = (J) =>
      gear.circle(J.sides.l.wrist, 6, COLORS.gearDark) +
      gear.circle(J.sides.r.wrist, 6, COLORS.gearDark);
    const legs = {
      l: { thigh: 95, shin: 92, tl: 0.35 },
      r: { thigh: 85, shin: 88, tl: 0.35 },
    };
    return {
      id: "reverse-pec-deck",
      label: "Reverse pec deck",
      hl: ["arm", "torso"],
      frames: [
        {
          view: "front",
          anchorX: 180,
          pose: {
            torso: -90,
            legs,
            arms: {
              l: { ua: 62, fa: -20, ul: 0.55, fl: 0.7 },
              r: { ua: 118, fa: -160, ul: 0.55, fl: 0.7 },
            },
          },
          gear: deck,
          gearFront: hands,
        },
        {
          view: "front",
          anchorX: 180,
          pose: {
            torso: -90,
            legs,
            arms: { l: { ua: 180, fa: 180 }, r: { ua: 0, fa: 0 } },
          },
          gear: deck,
          gearFront: hands,
        },
      ],
    };
  })(),
  (() => {
    const mach = (J) => {
      const pads = ["l", "r"]
        .map((k) => {
          const s = k === "l" ? -1 : 1;
          return gear.rect(
            J.sides[k].knee[0] + s * 7 - 5,
            J.sides[k].knee[1] - 16,
            10,
            34,
            COLORS.gear,
            4,
          );
        })
        .join("");
      return (
        gear.rect(J.hip[0] - 34, J.hip[1] + 10, 68, 9, COLORS.gear, 4) +
        gear.line([J.hip[0], J.hip[1] + 19], [J.hip[0], G + 4], 6) +
        pads
      );
    };
    return {
      id: "hip-abduction-machine",
      label: "Abductor machine",
      hl: ["thigh", "glute"],
      frames: [
        {
          view: "front",
          anchorX: 180,
          pose: {
            torso: -90,
            legs: {
              l: { thigh: 100, shin: 92, tl: 0.5 },
              r: { thigh: 80, shin: 88, tl: 0.5 },
            },
            arms: {
              l: { ua: 100, fa: 70, ul: 0.8 },
              r: { ua: 80, fa: 110, ul: 0.8 },
            },
          },
          gear: mach,
        },
        {
          view: "front",
          anchorX: 180,
          pose: {
            torso: -90,
            legs: {
              l: { thigh: 156, shin: 96, tl: 0.8 },
              r: { thigh: 24, shin: 84, tl: 0.8 },
            },
            arms: {
              l: { ua: 100, fa: 70, ul: 0.8 },
              r: { ua: 80, fa: 110, ul: 0.8 },
            },
          },
          gear: mach,
        },
      ],
    };
  })(),
  (() => {
    const cable = (J) => {
      const wr = J.near.wrist;
      return (
        gear.line([40, G + 4], [40, 130], 8, COLORS.gear) +
        gear.line([40, G - 6], wr, 2.5) +
        gear.circle([40, G - 6], 6) +
        gear.circle(wr, 6, COLORS.gear)
      );
    };
    return {
      id: "overhead-triceps-extension",
      label: "Estensioni sopra la testa al cavo",
      hl: ["arm", "forearm"],
      frames: [
        {
          anchor: "ankle",
          anchorX: 190,
          pose: { torso: -88, leg: stand, arm: { ua: -90, fa: 100 } },
          gear: cable,
        },
        {
          anchor: "ankle",
          anchorX: 190,
          pose: { torso: -88, leg: stand, arm: { ua: -92, fa: -80 } },
          gear: cable,
        },
      ],
    };
  })(),
  (() => {
    const pull = (J) => {
      const px = J.hip[0] + 130,
        py = J.shoulder[1] - 4;
      return (
        gear.line([px + 14, py + 10], [px + 14, G + 4], 8, COLORS.gear) +
        gear.line([px, py], J.near.wrist, 2.5) +
        gear.circle([px, py], 8, COLORS.gear) +
        gear.circle([px, py], 3) +
        gear.circle(J.near.wrist, 6, COLORS.gearDark)
      );
    };
    return {
      id: "face-pull",
      label: "Face pull",
      hl: ["arm", "torso"],
      frames: [
        {
          anchor: "ankle",
          anchorX: 130,
          pose: { torso: -90, leg: stand, arm: { wrist: [78, -2], bend: 1 } },
          gear: pull,
        },
        {
          anchor: "ankle",
          anchorX: 130,
          pose: { torso: -90, leg: stand, arm: { wrist: [24, -24], bend: -1 } },
          gear: pull,
        },
      ],
    };
  })(),
  (() => {
    const cable = (J) => {
      const px = J.hip[0] + 130,
        py = G - 8;
      return (
        gear.line([px + 14, py], [px + 14, G - 70], 8, COLORS.gear) +
        gear.line([px, py], J.near.wrist, 2.5) +
        gear.circle([px, py], 6) +
        gear.circle(J.near.wrist, 6, COLORS.gear)
      );
    };
    return {
      id: "cable-curl",
      label: "Curl al cavo",
      hl: ["arm", "forearm"],
      frames: [
        {
          anchor: "ankle",
          anchorX: 130,
          pose: { torso: -90, leg: stand, arm: { ua: 92, fa: 78 } },
          gear: cable,
        },
        {
          anchor: "ankle",
          anchorX: 130,
          pose: { torso: -90, leg: stand, arm: { ua: 90, fa: -76 } },
          gear: cable,
        },
      ],
    };
  })(),
  (() => {
    const pd = (J) => {
      const px = J.hip[0] + 60,
        py = 30;
      return (
        gear.line([px + 14, py], [px + 14, G + 4], 8, COLORS.gear) +
        gear.line([px, py], J.near.wrist, 2.5) +
        gear.circle([px, py], 8, COLORS.gear) +
        gear.circle([px, py], 3) +
        gear.circle(J.near.wrist, 6, COLORS.gearDark)
      );
    };
    const f = (wrist, bend) => ({
      anchorX: 130,
      pose: {
        torso: -92,
        head: -92,
        leg: { thigh: -5, shin: 92, foot: 0 },
        far: { leg: { thigh: 85, shin: 175, foot: 178 } },
        arm: { wrist, bend },
      },
      contact: ["feet", "farknee"],
      gear: pd,
    });
    return {
      id: "kneeling-pulldown",
      label: "Pulldown unilaterale in ginocchio",
      hl: ["torso", "arm"],
      frames: [f([28, -78], -1), f([26, 22], 1)],
    };
  })(),
  (() => {
    const ext = (J) => {
      const sh = Math.atan2(
        J.near.ankle[1] - J.near.knee[1],
        J.near.ankle[0] - J.near.knee[0],
      );
      const top = [Math.cos(sh - Math.PI / 2), Math.sin(sh - Math.PI / 2)];
      const padC = [
        J.near.ankle[0] + top[0] * 11 - Math.cos(sh) * 8,
        J.near.ankle[1] + top[1] * 11 - Math.sin(sh) * 8,
      ];
      const pivot = [J.near.knee[0] + 4, J.near.knee[1] + 46];
      return (
        gear.line(padC, pivot, 6) +
        gear.circle(pivot, 6) +
        seat(J) +
        gear.circle(padC, 9, COLORS.gear)
      );
    };
    const f = (shin, foot) => ({
      hipAbs: [120, 205],
      pose: {
        torso: -92,
        head: -92,
        leg: { thigh: -2, shin, foot },
        arm: { ua: 80, fa: 8 },
      },
      contact: null,
      gear: ext,
    });
    return {
      id: "leg-extension",
      label: "Leg extension",
      hl: ["thigh"],
      frames: [f(92, 0), f(2, -40)],
    };
  })(),
  (() => {
    const press = (J) => seat(J) + gear.plate(J.near.wrist, 17);
    const f = (wrist, bend) => ({
      anchorX: 130,
      pose: { torso: -95, head: -95, leg: seatedLegs, arm: { wrist, bend } },
      contact: ["feet"],
      gear: press,
    });
    return {
      id: "shoulder-press",
      label: "Shoulder press",
      hl: ["arm", "torso"],
      frames: [f([16, -8], 1), f([4, -83], -1)],
    };
  })(),
  (() => {
    const bench = (J) => {
      const t = dir(-135),
        back = dir(135);
      const o = add(J.hip, mul(back, 14));
      const a = add(o, mul(t, -8)),
        b = add(o, mul(t, 104));
      return (
        gear.line(a, b, 12, COLORS.gear) +
        gear.rect(J.hip[0] - 22, J.hip[1] + 12, 80, 9, COLORS.gear, 4) +
        gear.line([J.hip[0] + 4, J.hip[1] + 21], [J.hip[0] + 4, G + 4], 6) +
        gear.line(b, [b[0], G + 4], 5)
      );
    };
    const db = (J) => gear.dumbbellEnd(J.near.wrist, 11);
    return {
      id: "incline-dumbbell-press",
      label: "Panca inclinata con manubri",
      hl: ["torso", "arm"],
      frames: [
        {
          anchorX: 140,
          pose: {
            torso: -135,
            head: -135,
            leg: { thigh: -6, shin: 90, foot: 0 },
            arm: { ua: 100, fa: -85 },
          },
          contact: ["feet"],
          gear: bench,
          gearFront: db,
        },
        {
          anchorX: 140,
          pose: {
            torso: -135,
            head: -135,
            leg: { thigh: -6, shin: 90, foot: 0 },
            arm: { ua: -90, fa: -90 },
          },
          contact: ["feet"],
          gear: bench,
          gearFront: db,
        },
      ],
    };
  })(),
  (() => {
    const mat = (J) => gear.rect(J.hip[0] - 150, G - 2, 300, 6, COLORS.gear, 3);
    return {
      id: "side-plank",
      label: "Side plank con reach",
      hl: ["torso"],
      frames: [
        {
          flip: true,
          anchorX: 180,
          pose: {
            torso: 188,
            head: 188,
            leg: { thigh: 8, shin: 8, foot: 62 },
            arm: { ua: 90, fa: 180 },
            far: { arm: { ua: -90, fa: -90 } },
          },
          contact: ["feet"],
          gear: mat,
        },
        {
          flip: true,
          anchorX: 180,
          pose: {
            torso: 188,
            head: 188,
            leg: { thigh: 8, shin: 8, foot: 62 },
            arm: { ua: 90, fa: 180 },
            far: { arm: { ua: 60, fa: 18 } },
          },
          contact: ["feet"],
          gear: mat,
        },
      ],
    };
  })(),
  (() => {
    const pp = (J) => {
      const px = J.hip[0] + 90,
        py = 32;
      return (
        gear.line([px + 14, py], [px + 14, G + 4], 8, COLORS.gear) +
        gear.line([px, py], J.near.wrist, 2.5) +
        gear.circle([px, py], 8, COLORS.gear) +
        gear.circle([px, py], 3) +
        gear.circle(J.near.wrist, 6, COLORS.gearDark)
      );
    };
    return {
      id: "cable-pullover",
      label: "Pullover al cavo",
      hl: ["torso", "arm"],
      frames: [
        {
          anchor: "ankle",
          anchorX: 130,
          pose: { torso: -84, leg: stand, arm: { wrist: [58, -58], bend: 1 } },
          gear: pp,
        },
        {
          anchor: "ankle",
          anchorX: 130,
          pose: { torso: -80, leg: stand, arm: { wrist: [14, 80], bend: 1 } },
          gear: pp,
        },
      ],
    };
  })(),
  (() => {
    const pd = (J) => {
      const px = J.hip[0] + 40,
        py = 30;
      return (
        gear.line([px + 14, py], [px + 14, G + 4], 8, COLORS.gear) +
        gear.line([px, py], J.near.wrist, 2.5) +
        gear.circle([px, py], 8, COLORS.gear) +
        gear.circle([px, py], 3) +
        gear.circle(J.near.wrist, 6, COLORS.gearDark)
      );
    };
    return {
      id: "triceps-pushdown",
      label: "Pushdown al cavo",
      hl: ["arm", "forearm"],
      frames: [
        {
          anchor: "ankle",
          anchorX: 130,
          pose: { torso: -88, leg: stand, arm: { ua: 85, fa: -24 } },
          gear: pd,
        },
        {
          anchor: "ankle",
          anchorX: 130,
          pose: { torso: -88, leg: stand, arm: { ua: 85, fa: 82 } },
          gear: pd,
        },
      ],
    };
  })(),
  (() => {
    const row = (J) => {
      const t = dir(-52),
        n = dir(38);
      const a = add(add(J.hip, mul(t, 26)), mul(n, 17));
      const b = add(add(J.hip, mul(t, 100)), mul(n, 17));
      return (
        gear.line(a, b, 12, COLORS.gear) +
        gear.line(b, [b[0] + 16, G + 4], 5) +
        gear.rect(J.hip[0] - 30, J.hip[1] + 12, 64, 9, COLORS.gear, 4) +
        gear.line([J.hip[0], J.hip[1] + 21], [J.hip[0], G + 4], 6) +
        gear.circle(J.near.wrist, 7, COLORS.gearDark)
      );
    };
    const f = (wrist) => ({
      anchorX: 130,
      pose: { torso: -52, head: -52, leg: seatedLegs, arm: { wrist, bend: 1 } },
      contact: ["feet"],
      gear: row,
    });
    return {
      id: "chest-supported-row",
      label: "Row con appoggio sul petto",
      hl: ["torso", "arm"],
      frames: [f([22, 78]), f([-6, 36])],
    };
  })(),
  (() => {
    const bench = (J) => {
      const t = dir(-120),
        back = dir(150);
      const o = add(J.hip, mul(back, 14));
      const a = add(o, mul(t, -8)),
        b = add(o, mul(t, 104));
      return (
        gear.line(a, b, 12, COLORS.gear) +
        gear.rect(J.hip[0] - 22, J.hip[1] + 12, 80, 9, COLORS.gear, 4) +
        gear.line([J.hip[0] + 4, J.hip[1] + 21], [J.hip[0] + 4, G + 4], 6) +
        gear.line(b, [b[0], G + 4], 5)
      );
    };
    const db = (J) => gear.dumbbellEnd(J.near.wrist, 11);
    return {
      id: "incline-dumbbell-curl",
      label: "Curl su panca inclinata",
      hl: ["arm", "forearm"],
      frames: [
        {
          anchorX: 150,
          pose: {
            torso: -120,
            head: -120,
            leg: { thigh: -6, shin: 90, foot: 0 },
            arm: { ua: 90, fa: 90 },
          },
          contact: ["feet"],
          gear: bench,
          gearFront: db,
        },
        {
          anchorX: 150,
          pose: {
            torso: -120,
            head: -120,
            leg: { thigh: -6, shin: 90, foot: 0 },
            arm: { ua: 90, fa: -62 },
          },
          contact: ["feet"],
          gear: bench,
          gearFront: db,
        },
      ],
    };
  })(),
  {
    id: "corsa",
    label: "Corsa",
    hl: ["thigh", "shin"],
    frames: [
      {
        hipAbs: [180, 168],
        pose: {
          torso: -82,
          head: -82,
          leg: { thigh: 25, shin: 95, foot: 20 },
          far: {
            leg: { thigh: 128, shin: -160, foot: -150 },
            arm: { ua: 135, fa: 80 },
          },
          arm: { ua: 35, fa: -70 },
        },
        contact: null,
      },
      {
        hipAbs: [180, 168],
        pose: {
          torso: -82,
          head: -82,
          leg: { thigh: 128, shin: -160, foot: -150 },
          far: {
            leg: { thigh: 25, shin: 95, foot: 20 },
            arm: { ua: 35, fa: -70 },
          },
          arm: { ua: 135, fa: 80 },
        },
        contact: null,
      },
    ],
  },
];
