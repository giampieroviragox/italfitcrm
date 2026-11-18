import { gear, COLORS } from "./engine.mjs";

const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const dir = (a) => [
  Math.cos((a * Math.PI) / 180),
  Math.sin((a * Math.PI) / 180),
];
const G = 268; // ground y

export const exercises = [
  {
    id: "romanian-deadlift",
    label: "Stacco rumeno",
    hl: ["thigh", "glute"],
    frames: [
      {
        anchor: "ankle",
        anchorX: 170,
        pose: {
          torso: -90,
          leg: { thigh: 90, shin: 90, foot: 0 },
          arm: { ua: 85, fa: 90 },
        },
        gear: (J) => gear.plate(J.near.wrist, 22),
      },
      {
        anchor: "ankle",
        anchorX: 170,
        pose: {
          torso: -32,
          head: -40,
          leg: { thigh: 78, shin: 98, foot: 0 },
          arm: { ua: 90, fa: 90 },
        },
        gear: (J) => gear.plate(J.near.wrist, 22),
      },
    ],
  },
  {
    id: "goblet-squat",
    label: "Goblet squat",
    hl: ["thigh", "glute"],
    frames: [
      {
        anchor: "ankle",
        anchorX: 160,
        pose: {
          torso: -90,
          leg: { thigh: 90, shin: 90, foot: 0 },
          arm: { ua: 80, fa: -55 },
        },
        gearFront: (J) => gear.dumbbellV(J.near.wrist, 30),
      },
      {
        anchor: "ankle",
        anchorX: 160,
        pose: {
          torso: -70,
          leg: { thigh: 8, shin: 112, foot: 0 },
          arm: { ua: 80, fa: -55 },
        },
        gearFront: (J) => gear.dumbbellV(J.near.wrist, 30),
      },
    ],
  },
  (() => {
    const bench = (J) => {
      const top = J.hip[1] + 12;
      const x0 = J.shoulder[0] - 34,
        x1 = J.hip[0] + 24;
      return (
        gear.rect(x0, top, x1 - x0, 12, COLORS.gear, 5) +
        gear.line([x0 + 14, top + 12], [x0 + 14, G + 4], 5) +
        gear.line([x1 - 14, top + 12], [x1 - 14, G + 4], 5)
      );
    };
    return {
      id: "bench-press",
      label: "Panca piana",
      hl: ["torso", "arm"],
      frames: [
        {
          flip: true,
          anchorX: 150,
          pose: {
            torso: 180,
            head: 180,
            leg: { thigh: 4, shin: 92, foot: 0 },
            arm: { ua: -90, fa: -90 },
          },
          contact: ["feet"],
          gear: (J) => bench(J) + gear.plate(J.near.wrist, 22),
        },
        {
          flip: true,
          anchorX: 150,
          pose: {
            torso: 180,
            head: 180,
            leg: { thigh: 4, shin: 92, foot: 0 },
            arm: { ua: 62, fa: -105 },
          },
          contact: ["feet"],
          gear: (J) => bench(J) + gear.plate(J.near.wrist, 22),
        },
      ],
    };
  })(),
  (() => {
    const press = (J) => {
      const u = dir(-37),
        n = dir(-127),
        back = dir(145);
      const ankle = J.near.ankle;
      const P = add(ankle, [u[0] * 9, u[1] * 9]);
      const plat = gear.line(
        add(P, [n[0] * 46, n[1] * 46]),
        add(P, [-n[0] * 46, -n[1] * 46]),
        9,
        COLORS.gear,
      );
      const o = [back[0] * 14, back[1] * 14];
      const b0 = add(J.hip, o),
        b1 = add(b0, [dir(-125)[0] * 96, dir(-125)[1] * 96]);
      const rest = gear.line(b0, b1, 10, COLORS.gear);
      const r0 = add(b0, [4, 14]);
      const r1 = add(r0, [u[0] * 150, u[1] * 150]);
      const rail = gear.line(r0, r1, 6, COLORS.gearDark);
      const legs =
        gear.line(r0, [r0[0], G + 4], 5) +
        gear.line(
          add(r0, [u[0] * 100, u[1] * 100]),
          [add(r0, [u[0] * 100, u[1] * 100])[0], G + 4],
          5,
        );
      return legs + rail + rest + plat;
    };
    const frame = (dist) => ({
      hipAbs: [120, 205],
      pose: {
        torso: -125,
        head: -125,
        leg: {
          ankle: [
            Math.cos((-37 * Math.PI) / 180) * dist,
            Math.sin((-37 * Math.PI) / 180) * dist,
          ],
          foot: -127,
          bend: -1,
        },
        arm: { ua: 70, fa: 10 },
      },
      contact: null,
      gear: press,
    });
    return {
      id: "leg-press",
      label: "Leg press",
      hl: ["thigh", "glute"],
      frames: [frame(70), frame(112)],
    };
  })(),
  (() => {
    const pull = (J) => {
      const px = J.hip[0] + 64;
      const wr = J.near.wrist;
      const seat =
        gear.rect(J.hip[0] - 26, J.hip[1] + 12, 52, 9, COLORS.gear, 4) +
        gear.line([J.hip[0], J.hip[1] + 21], [J.hip[0], G + 4], 6);
      const pad = gear.line(
        [J.hip[0] + 22, J.hip[1] - 18],
        [J.hip[0] + 62, J.hip[1] - 18],
        9,
        COLORS.gear,
      );
      const pulley =
        gear.circle([px, 26], 9, COLORS.gear) + gear.circle([px, 26], 3);
      const mast = gear.line([px + 14, 26], [px + 14, G + 4], 6);
      const cable = gear.line([px, 26], [wr[0], wr[1]], 2.5, COLORS.gearDark);
      const bar = gear.circle(wr, 5, COLORS.gearDark);
      return mast + pulley + seat + pad + cable + bar;
    };
    const frame = (wrist) => ({
      anchorX: 120,
      pose: {
        torso: -98,
        head: -98,
        leg: { thigh: -4, shin: 90, foot: 0 },
        arm: { wrist, bend: wrist[1] < -40 ? -1 : 1 },
      },
      contact: ["feet"],
      gear: pull,
    });
    return {
      id: "lat-pulldown",
      label: "Lat machine",
      hl: ["torso", "arm"],
      frames: [frame([30, -80]), frame([28, 4])],
    };
  })(),
  (() => {
    const curl = (J) => {
      const seat =
        gear.rect(J.hip[0] - 24, J.hip[1] + 12, 70, 9, COLORS.gear, 4) +
        gear.line([J.hip[0] + 6, J.hip[1] + 21], [J.hip[0] + 6, G + 4], 6);
      const rest = gear.line(
        [J.hip[0] - 16, J.hip[1] + 8],
        [J.hip[0] - 22, J.hip[1] - 88],
        11,
        COLORS.gear,
      );
      const shinA = Math.atan2(
        J.near.ankle[1] - J.near.knee[1],
        J.near.ankle[0] - J.near.knee[0],
      );
      const topv = [
        Math.cos(shinA - Math.PI / 2),
        Math.sin(shinA - Math.PI / 2),
      ];
      const padC = [
        J.near.ankle[0] + topv[0] * 11 - Math.cos(shinA) * 8,
        J.near.ankle[1] + topv[1] * 11 - Math.sin(shinA) * 8,
      ];
      const pivot = [J.near.knee[0] + 4, J.near.knee[1] + 46];
      const thighPad = gear.line(
        [J.hip[0] + 34, J.hip[1] - 17],
        [J.hip[0] + 66, J.hip[1] - 17],
        9,
        COLORS.gear,
      );
      return (
        gear.line(padC, pivot, 6, COLORS.gearDark) +
        gear.circle(pivot, 6) +
        seat +
        rest +
        thighPad +
        gear.circle(padC, 9, COLORS.gear)
      );
    };
    const frame = (shin) => ({
      hipAbs: [120, 205],
      pose: {
        torso: -92,
        head: -92,
        leg: { thigh: -2, shin, foot: shin + 90 > 150 ? 60 : 0 },
        arm: { ua: 80, fa: 8 },
      },
      contact: null,
      gear: curl,
    });
    return {
      id: "leg-curl-seated",
      label: "Leg curl seduto",
      hl: ["shin", "thigh"],
      frames: [frame(0), frame(100)],
    };
  })(),
  (() => {
    const bench = (J) => {
      const top = G + 4 - 46;
      const x0 = J.shoulder[0] - 62,
        x1 = J.shoulder[0] + 14;
      return gear.rect(x0, top, x1 - x0, 46, COLORS.gear, 6);
    };
    const bar = (J) => gear.plate(add(J.hip, [8, -14]), 22);
    const frame = (torso, thigh, shin) => ({
      flip: true,
      anchor: "ankle",
      anchorX: 170,
      pose: {
        torso,
        head: torso,
        leg: { thigh, shin, foot: 0 },
        arm: { wrist: [-50, 30], bend: 1 },
      },
      contact: ["feet"],
      gear: (J) => bench(J) + bar(J),
    });
    return {
      id: "hip-thrust",
      label: "Hip thrust",
      hl: ["glute", "thigh"],
      frames: [frame(-161, -25, 95), frame(160, 20, 90)],
    };
  })(),
  {
    id: "plank",
    label: "Plank",
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
        },
        contact: ["feet"],
        gear: (J) =>
          gear.rect(J.near.wrist[0] - 40, G + 2, 130, 5, COLORS.gear, 2),
      },
    ],
  },
  {
    id: "push-up",
    label: "Piegamenti sulle braccia",
    hl: ["torso", "arm", "forearm"],
    frames: [
      {
        flip: true,
        anchorX: 180,
        pose: {
          torso: 201,
          head: 201,
          leg: { thigh: 21, shin: 21, foot: 65 },
          arm: { wrist: [0, 82], bend: -1 },
        },
        contact: ["feet"],
      },
      {
        flip: true,
        anchorX: 180,
        pose: {
          torso: 186,
          head: 186,
          leg: { thigh: 5.6, shin: 5.6, foot: 65 },
          arm: { wrist: [-8, 40], bend: -1 },
        },
        contact: ["feet"],
      },
    ],
  },
  (() => {
    const rack = (J, barY) => {
      const wr = J.near.wrist;
      const px = wr[0] + 72;
      return (
        gear.line([px, G + 4], [px, barY - 6], 6) +
        gear.line([px, barY - 6], [wr[0], barY], 5) +
        gear.circle([wr[0], barY], 6, COLORS.gearDark)
      );
    };
    return {
      id: "pull-up",
      label: "Trazioni alla sbarra",
      hl: ["torso", "arm"],
      frames: [
        {
          hipAbs: [150, 180],
          pose: {
            torso: -90,
            head: -90,
            leg: { thigh: 100, shin: 165, foot: 150 },
            arm: { wrist: [4, -83], bend: -1 },
          },
          contact: null,
          gear: (J) => rack(J, 30),
        },
        {
          hipAbs: [150, 98],
          pose: {
            torso: -90,
            head: -90,
            leg: { thigh: 100, shin: 165, foot: 150 },
            arm: { ua: 100, fa: -80 },
          },
          contact: null,
          gear: (J) => rack(J, 30),
        },
      ],
    };
  })(),
];
