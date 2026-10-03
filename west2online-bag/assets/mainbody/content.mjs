// Historical initial-layout reference only. Neither build nor render imports this file.
// Edit mainbody.svg for all content/layout changes; mainbody.css owns visual styles.
// Read left to right, then top to bottom; empty cells carry editable small copy.
// ONE glyph per cell. A cropped letter has only one visible fragment, without shifts.
// keep = visible side (or 'all'); fraction = retained proportion of the glyph bounds.
export const cells = [
  { letter: 'w', keep: 'all' },
  { letter: 'e', keep: 'right', fraction: 1 / 2 }, // Keep the crossbar and open terminal.
  { letter: 's', keep: 'top', fraction: 2 / 3 }, // Keep the upper bowl and diagonal turn.
  { letter: 't', keep: 'right', fraction: 1 / 2 },

  { copy: Array(9).fill('FOR THE LOVE OF DESIGN'), copyAt: [8, 115] },
  { letter: '2', keep: 'all', tone: 'accent' },
  { letter: 'o', keep: 'top', fraction: 1 / 2 },
  { copy: ['DESIGN INCREDIBLE'], copyAt: [8, 183], extra: 'short' },

  { letter: 'n', keep: 'top', fraction: 1 / 2 }, // Keep the shoulder and both stem tops.
  { letter: 'l', keep: 'bottom', fraction: 2 / 3 }, // Keep the long stem and curved foot.
  { copy: ['PLACEHOLDER TEXT'], copyAt: [8, 183], extra: 'vertical' },
  { letter: 'i', keep: 'top', fraction: 2 / 3 }, // Keep the dot and the stem together.

  { letter: 'n', keep: 'top', fraction: 1 / 2, extra: 'short' },
  { copy: ['PAPER MONO'], copyAt: [8, 183] },
  { letter: 'e', keep: 'right', fraction: 1 / 2 },
  { asset: { href: '../icon/west2-online-logo.svg', x: 20, y: 72, width: 200, height: 200, label: 'West2 Online logo' } },
];

export const captions = {
  top: 'PAPER MONO',
  bottomLeft: 'PAPER MONO',
  bottomRight: 'PAPER DESIGN',
};
