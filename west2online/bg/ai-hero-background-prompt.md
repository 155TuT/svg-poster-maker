# AI 主视觉背景生成提示词

生成方式：Codex 内置 `image_gen`。子代理无法把自身模型指定为 `gpt-image-2`；内置路由未暴露底层图像模型名。

```text
Use case: ads-marketing
Asset type: text-free abstract hero background for an A4 portrait community recruitment/event poster
Primary request: Create a refined, print-ready abstract visual system inspired only by the palette and geometric rhythm of Image 1, the official west2-online organization avatar. Do not redraw, trace, alter, or reproduce the logo itself.
Input images: Image 1: color and geometric-rhythm reference only, not an edit target
Scene/backdrop: an editorial poster field built from a precise modular grid, layered orthogonal blocks, narrow pathways, circuit-like bridges, open ports, and a few controlled translucent planes; express a technical student community, modular collaboration, open connection, code systems, and ideas moving between nodes
Subject: one strong abstract architectural/computational structure with a clear focal region, surrounded by restrained grid fragments and connection paths; no literal devices, no people
Style/medium: premium Swiss-influenced graphic design with contemporary developer-community energy; crisp vector-like geometry plus subtle paper grain and very light risograph texture; sophisticated and minimal, not sci-fi concept art
Composition/framing: strict A4 portrait ratio, edge-to-edge full bleed; preserve generous calm negative space in the upper third and a quieter lower band so a designer can later add headline and details; visual energy concentrated around the middle and lower-middle; excellent hierarchy at both thumbnail scale and print size
Lighting/mood: flat graphic depth with restrained soft shadows and translucent overlaps; confident, open, optimistic, technically precise
Color palette: dominant graphite charcoal and deep warm gray; vivid warm orange as the only strong accent; warm milk-white and pale cream as breathing space; tiny muted gray variations only; no blue, cyan, purple, green, or neon
Materials/textures: subtle uncoated paper grain, very fine halftone/riso speckle in limited areas, crisp clean edges, no distressed grunge
Text: none
Constraints: no letters, no numbers, no words, no typographic glyphs, no code snippets, no QR code, no icons, no humans, no faces, no watermark; do not include or imitate the west2-online logo; keep the negative-space zones genuinely uncluttered; must function as a background that supports later deterministic typography
Avoid: generic cyberpunk, glowing neon, literal circuit boards, gradients that introduce new hues, busy full-canvas noise, stock-tech imagery, fake UI, 3D chrome, logo-like central marks
```
