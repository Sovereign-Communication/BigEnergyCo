// Shared appliance catalog used by the sizing UI and offline regression harness.
// Values are running watts and hours/day; duty-cycle items cap realistic runtime.
export const APPLIANCES = [
  {
    g: "Keep food cold",
    items: [
      {
        n: "Refrigerator (modern, mid-size)",
        w: 100,
        h: 10,
        maxH: 16,
        duty: true,
        surgeW: 500,
      },
      {
        n: "Refrigerator (old or large)",
        w: 150,
        h: 12,
        maxH: 18,
        duty: true,
        surgeW: 800,
      },
      { n: "Chest freezer", w: 100, h: 10, maxH: 16, duty: true, surgeW: 500 },
    ],
  },
  {
    g: "Cooling & Climate",
    items: [
      { n: "Ceiling or desk fan", w: 75, h: 8 },
      {
        n: "Window air conditioner (one room)",
        w: 500,
        h: 6,
        maxH: 20,
        duty: true,
        surgeW: 1500,
      },
      {
        n: "Split air conditioner (whole floor)",
        w: 1200,
        h: 6,
        maxH: 20,
        duty: true,
        surgeW: 3000,
      },
      {
        n: "Mini-split heat pump (heating mode)",
        w: 1200,
        h: 8,
        maxH: 20,
        duty: true,
        surgeW: 2400,
      },
    ],
  },
  {
    g: "Kitchen & cooking",
    items: [
      { n: "Microwave", w: 1200, h: 0.33 },
      { n: "Electric kettle", w: 1500, h: 0.25 },
      { n: "Coffee maker", w: 900, h: 0.25 },
      { n: "Rice cooker", w: 700, h: 0.5 },
      { n: "Induction cooktop (1 burner)", w: 1800, h: 0.5 },
      { n: "Air fryer", w: 1500, h: 0.33 },
    ],
  },
  {
    g: "Lights & electronics",
    items: [
      { n: "LED light bulb", w: 10, h: 5 },
      { n: "LED TV", w: 100, h: 4 },
      { n: "Laptop or desktop computer", w: 65, h: 6 },
      { n: "Phone charger", w: 15, h: 3 },
      { n: "Internet router (always on)", w: 10, h: 24 },
      { n: "Starlink / Satellite Internet", w: 55, h: 24 },
    ],
  },
  {
    g: "Cleaning & water",
    items: [
      { n: "Washing machine", w: 500, h: 0.5, surgeW: 1200 },
      {
        n: "Water pump (shallow/pressure tank 120V)",
        w: 750,
        h: 0.5,
        maxH: 12,
        duty: true,
        surgeW: 2200,
      },
      {
        n: "Deep well pump (submersible, 240V)",
        w: 1100,
        h: 0.75,
        maxH: 8,
        duty: true,
        surgeW: 3800,
        splitPhase: true,
      },
      { n: "Vacuum cleaner", w: 800, h: 0.25 },
      { n: "Clothes iron", w: 1100, h: 0.25 },
    ],
  },
  {
    g: "Big power users",
    items: [
      { n: "Space heater (small)", w: 1000, h: 4, maxH: 16, duty: true },
      {
        n: "Electric water heater (240V)",
        w: 3000,
        h: 1,
        maxH: 8,
        duty: true,
        splitPhase: true,
      },
      { n: "Pool pump", w: 1000, h: 4, maxH: 12, duty: true, surgeW: 2500 },
      { n: "EV charger (Level 1 trickle, 120V 12A)", w: 1400, h: 6, maxH: 14 },
      {
        n: "Workshop tools (table saw / compressor)",
        w: 1800,
        h: 0.5,
        surgeW: 4200,
      },
    ],
  },
];

export const APPLIANCE_ITEMS = APPLIANCES.flatMap((group) => group.items);
export const APPLIANCE_NAMES = new Set(APPLIANCE_ITEMS.map((item) => item.n));
