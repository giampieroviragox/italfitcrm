import { gear, COLORS } from "./engine.mjs";

const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const dir = (a) => [
  Math.cos((a * Math.PI) / 180),
  Math.sin((a * Math.PI) / 180),
];
const mul = (v, k) => [v[0] * k, v[1] * k];
const G = 268;
const stand = { thigh: 90, shin: 90, foot: 0 };

const lunge = {
  near: { thigh: 5, shin: 90, foot: 0 },
  far: { thigh: 105, shin: -174, foot: 60 },
};

export const exercises2 = [
  {
    id: "back-squat",
    label: "Back squat",
    hl: ["thigh", "glute"],
    frames: [
      {
        anchor: "ankle",
        anchorX: 160,
        pose: { torso: -90, leg: stand, arm: { ua: 110, fa: -60 } },
        gear: (J) => gear.plate(add(J.shoulder, [2, -1]), 18),
      },
      {
        anchor: "ankle",
        anchorX: 160,
        pose: {
          torso: -64,
          head: -70,
          leg: { thigh: 6, shin: 110, foot: 0 },
          arm: { ua: 110, fa: -60 },
        },
        gear: (J) => gear.plate(add(J.shoulder, [2, -1]), 18),
      },
    ],
  },
  {
    id: "hollow-hold",
    label: "Hollow hold",
    hl: ["torso"],
    frames: [
      {
        flip: true,
        anchorX: 190,
        pose: {
          torso: 204,
          head: 204,
          leg: { thigh: -22, shin: -22, foot: -22 },
          arm: { ua: 204, fa: 204 },
        },
        contact: ["hip"],
        gear: (J) => gear.rect(J.hip[0] - 150, G - 2, 300, 6, COLORS.gear, 3),
      },
    ],
  },
  {
    id: "reverse-lunge",
    label: "Affondo indietro",
    hl: ["thigh", "glute"],
    frames: [
      {
        anchor: "ankle",
        anchorX: 190,
        pose: { torso: -90, leg: stand, arm: { ua: 90, fa: 90 } },
        gear: (J) => gear.dumbbellEnd(J.near.wrist, 11),
      },
      {
        anchor: "ankle",
        anchorX: 190,
        pose: {
          torso: -90,
          leg: lunge.near,
          far: { leg: lunge.far },
          arm: { ua: 90, fa: 90 },
        },
        contact: ["feet", "far"],
        gear: (J) => gear.dumbbellEnd(J.near.wrist, 11),
      },
    ],
  },
  (() => {
    const smith = (J) => {
      const px = J.shoulder[0] + 46;
      return (
        gear.line([px, G + 4], [px, J.shoulder[1] - 70], 6) +
        gear.line([px - 100, G + 4], [px - 100, J.shoulder[1] - 70], 6) +
        gear.line(
          [px - 100, J.shoulder[1]],
          [px, J.shoulder[1]],
          4,
          COLORS.gear,
        ) +
        gear.circle(J.shoulder, 8, COLORS.gear)
      );
    };
    return {
      id: "split-squat",
      label: "Split squat",
      hl: ["thigh", "glute"],
      frames: [
        {
          anchor: "ankle",
          anchorX: 190,
          pose: {
            torso: -90,
            leg: { thigh: 62, shin: 100, foot: 0 },
            far: { leg: { thigh: 112, shin: 137, foot: 60 } },
            arm: { ua: 110, fa: -60 },
          },
          contact: ["feet", "far"],
          gear: smith,
        },
        {
          anchor: "ankle",
          anchorX: 190,
          pose: {
            torso: -90,
            leg: { thigh: 12, shin: 90, foot: 0 },
            far: { leg: lunge.far },
            arm: { ua: 110, fa: -60 },
          },
          contact: ["feet", "far"],
          gear: smith,
        },
      ],
    };
  })(),
  (() => {
    const calf = (J) => {
      const x = J.shoulder[0] + 36;
      return (
        gear.rect(
          J.shoulder[0] - 22,
          J.shoulder[1] - 16,
          44,
          12,
          COLORS.gear,
          5,
        ) +
        gear.line([x, J.shoulder[1] - 10], [x, G + 4], 6) +
        gear.rect(J.near.ankle[0] - 26, G - 6, 80, 12, COLORS.gear, 3)
      );
    };
    return {
      id: "calf-raise",
      label: "Calf raise",
      hl: ["shin"],
      frames: [
        {
          anchor: "ankle",
          anchorX: 170,
          pose: {
            torso: -90,
            leg: { thigh: 90, shin: 90, foot: 0 },
            arm: { ua: 80, fa: -60 },
          },
          gear: calf,
        },
        {
          anchor: "ankle",
          anchorX: 170,
          pose: {
            torso: -90,
            leg: { thigh: 90, shin: 90, foot: 62 },
            arm: { ua: 80, fa: -60 },
          },
          gear: calf,
        },
      ],
    };
  })(),
  (() => {
    const hack = (J) => {
      const t = dir(-112),
        back = dir(158);
      const o = add(J.hip, mul(back, 16));
      const a = add(o, mul(t, -70)),
        b = add(o, mul(t, 130));
      const ax = J.near.ankle[0],
        ay = J.near.ankle[1];
      return (
        gear.line(a, b, 12, COLORS.gear) +
        gear.line(add(a, [-8, 20]), [add(a, [-8, 20])[0], G + 4], 5) +
        gear.line(add(b, [8, 0]), [add(b, [8, 0])[0], G + 4], 5) +
        gear.rect(ax - 22, ay + 6, 84, 10, COLORS.gear, 3)
      );
    };
    return {
      id: "hack-squat",
      label: "Hack squat",
      hl: ["thigh", "glute"],
      frames: [
        {
          anchor: "ankle",
          anchorX: 190,
          pose: {
            torso: -112,
            head: -112,
            leg: { thigh: 80, shin: 82, foot: 0 },
            arm: { ua: 80, fa: -20 },
          },
          gear: hack,
        },
        {
          anchor: "ankle",
          anchorX: 190,
          pose: {
            torso: -112,
            head: -112,
            leg: { thigh: 15, shin: 100, foot: 0 },
            arm: { ua: 80, fa: -20 },
          },
          gear: hack,
        },
      ],
    };
  })(),
  (() => {
    const dumbbells = (J) =>
      gear.dumbbellEnd(J.far.wrist, 11) + gear.dumbbellEnd(J.near.wrist, 12);
    const frame = (n, f2) => ({
      anchorX: 180,
      anchor: "ankle",
      pose: { torso: -90, leg: n, far: { leg: f2 }, arm: { ua: 90, fa: 90 } },
      contact: ["feet", "far"],
      gearFront: dumbbells,
    });
    return {
      id: "farmers-carry",
      label: "Farmer carry",
      hl: ["arm", "forearm"],
      frames: [
        frame(
          { thigh: 108, shin: 100, foot: 25 },
          { thigh: 72, shin: 85, foot: 0 },
        ),
        frame(
          { thigh: 72, shin: 85, foot: 0 },
          { thigh: 108, shin: 100, foot: 25 },
        ),
      ],
    };
  })(),
  {
    id: "suitcase-hold",
    label: "Suitcase hold",
    hl: ["torso"],
    frames: [
      {
        anchor: "ankle",
        anchorX: 180,
        pose: { torso: -90, leg: stand, arm: { ua: 90, fa: 90 } },
        gearFront: (J) => gear.dumbbellEnd(J.near.wrist, 12),
      },
    ],
  },
  (() => {
    const mat = (J) => gear.rect(J.hip[0] - 150, G - 2, 300, 6, COLORS.gear, 3);
    const frame = (nearLeg, farLeg, nearArm, farArm) => ({
      flip: true,
      anchorX: 190,
      pose: {
        torso: 180,
        head: 180,
        leg: nearLeg,
        far: { leg: farLeg, arm: farArm },
        arm: nearArm,
      },
      contact: ["hip"],
      gear: mat,
    });
    const tabletop = { thigh: -90, shin: 0, foot: 0 };
    const straight = { thigh: -14, shin: -14, foot: -14 };
    const up = { ua: -90, fa: -90 };
    const over = { ua: 190, fa: 190 };
    return {
      id: "dead-bug",
      label: "Dead bug",
      hl: ["torso"],
      frames: [
        frame(straight, tabletop, up, over),
        frame(tabletop, straight, over, up),
      ],
    };
  })(),
  (() => {
    const BAR = 136;
    const rack = (J) => {
      const wr = J.near.wrist;
      const barY = G + 4 - BAR;
      const px = wr[0] + 72;
      return (
        gear.line([px, G + 4], [px, barY - 6], 6) +
        gear.line([px, barY - 6], [wr[0], barY], 5) +
        gear.circle([wr[0], barY], 6)
      );
    };
    return {
      id: "inverted-row",
      label: "Inverted row",
      hl: ["torso", "arm"],
      frames: [
        {
          flip: true,
          anchorX: 200,
          pose: {
            torso: 190,
            head: 190,
            leg: { thigh: 10, shin: 10, foot: 70 },
            arm: { wrist: [0, -83], bend: 1 },
          },
          contact: ["feet"],
          gear: rack,
        },
        {
          flip: true,
          anchorX: 200,
          pose: {
            torso: 207,
            head: 207,
            leg: { thigh: 27, shin: 27, foot: 70 },
            arm: { wrist: [4, -30], bend: -1 },
          },
          contact: ["feet"],
          gear: rack,
        },
      ],
    };
  })(),
  (() => {
    const mine = (J) => {
      const wr = J.near.wrist;
      const pivot = [wr[0] + 140, G + 2];
      const d = [wr[0] - pivot[0], wr[1] - pivot[1]];
      const l = Math.hypot(d[0], d[1]);
      const end = [wr[0] + (d[0] / l) * 16, wr[1] + (d[1] / l) * 16];
      return (
        gear.line(pivot, end, 6, COLORS.gearDark) +
        gear.circle(end, 8, COLORS.gear) +
        gear.circle(pivot, 6)
      );
    };
    return {
      id: "landmine-press",
      label: "Landmine press",
      hl: ["arm", "forearm"],
      frames: [
        {
          anchor: "ankle",
          anchorX: 120,
          pose: { torso: -88, leg: stand, arm: { wrist: [24, 4], bend: 1 } },
          gear: mine,
        },
        {
          anchor: "ankle",
          anchorX: 120,
          pose: { torso: -86, leg: stand, arm: { wrist: [52, -56], bend: 1 } },
          gear: mine,
        },
      ],
    };
  })(),
];
