// Every term the app cannot avoid, explained where it is used.
export const GLOSSARY = {
  block: {
    term: "15-minute block",
    body: "The grid prices electricity in 15-minute slots, so a good day can still contain expensive quarter-hours. Three days is 288 of them.",
  },
  schedule: {
    term: "schedule",
    body: "The output you promised the load dispatch centre ahead of time. Charges are measured against this promise, not against what your plant could have produced.",
  },
  band: {
    term: "tolerance band",
    body: "How far you may miss your schedule before charges start: ±5% for solar and ±10% for wind, under the CERC rules in force since 31 August 2026.",
  },
  deviation: {
    term: "deviation charge",
    body: "What you pay for every unit generated outside the band, whether you produced too little or too much.",
  },
  slab: {
    term: "slab rate",
    body: "The price per unit once you are outside the band. It steps up the further out you go: ₹0.25, then ₹0.50, then ₹0.75.",
  },
  overInjection: {
    term: "over-injection",
    body: "Producing more than you promised. If grid frequency is 50.05 Hz or above, nobody pays you for that surplus, so it is pure waste.",
  },
  curtail: {
    term: "curtail",
    body: "Deliberately produce less, usually by turning inverters down, to stay near the schedule you filed.",
  },
  storage: {
    term: "dispatch storage",
    body: "Discharge a battery to cover a shortfall, so the grid still sees the output you promised.",
  },
  soiling: {
    term: "soiling",
    body: "Dust and dirt settling on panels. It builds up slowly and quietly costs output until someone cleans them.",
  },
  baseline: {
    term: "naive baseline",
    body: "The simplest possible forecast: assume tomorrow repeats today. A real model has to beat it to be worth running.",
  },
  typicalMiss: {
    term: "typical miss",
    body: "On an average block, how far the forecast sat from what actually happened. Shown as a share of plant capacity so plants of any size compare fairly.",
  },
};
