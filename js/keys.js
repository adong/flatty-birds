/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "FlaTTy Birds",
  keys: [
    ["hop", "Space ↑ W or Enter"],
    ["pick a flyer (title)", "← → or A D"],
    ["call your brother", "T"],
    ["easy mode (title)", "E"],
    ["pause", "P or Esc"],
    ["sound on / off", "M"],
  ],
  touch: "Tap anywhere to hop. Tap your brother's face (bottom right) to call him.",
});
