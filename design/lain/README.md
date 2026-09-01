# Lain 彩色 ASCII 主视觉

## 转换方式

- `generate-ascii.mjs` 使用 Sharp 解码 `Lain.webp`，先缩放到可调的字符采样网格。
- 每个有效采样点以亮度选择 ASCII 字符，以该点原始 RGB 作为字符颜色，以原始 Alpha 作为字符透明度。
- 完全透明和低于阈值的采样点不生成字符，因此 SVG 与 PNG 都没有补底色，原图透明背景会被保留。
- SVG 只包含可编辑文字和 `<use>` 实例，不嵌入原始位图；PNG 是用于直接排版的 300 dpi 透明导出。
- 源图 `Lain.webp` 只读，不会被覆盖。

这里不额外引入面向终端的 ASCII Art 库：此类库通常只输出 ANSI/纯文本或黑白画面，难以同时保证 SVG、逐字符原色和 Alpha。脚本只依赖项目已在使用的 Sharp，并固定版本为 `0.35.3`。

## 文件

- `Lain.webp`：原始主视觉，保持不变。
- `generate-ascii.mjs`：彩色 ASCII SVG/PNG 生成脚本。
- `verify-ascii.mjs`：检查输出确实由字符构成，并保留透明与抗锯齿像素。
- `output/svg/Lain-ascii.svg`：透明底、可缩放的默认 ASCII 主视觉。
- `output/svg/Lain-ascii-fine.svg`：透明底、可缩放的 180 列精细版。
- `output/png/Lain-ascii.png`：透明底、300 dpi 的默认海报排版用 PNG。
- `output/png/Lain-ascii-fine.png`：透明底、300 dpi 的 180 列精细版 PNG。

## 使用

首次使用：

```powershell
npm.cmd --prefix poster\design\lain install
```

按默认 120 列采样生成并验证：

```powershell
npm.cmd --prefix poster\design\lain run check
```

生成并验证更细的 180 列版本：

```powershell
npm.cmd --prefix poster\design\lain run check:fine
```

也可以直接指定参数，例如生成 220 列的高精细输出：

```powershell
node poster\design\lain\generate-ascii.mjs --columns 220 --png-scale 2 --svg output/svg/Lain-ascii-220.svg --png output/png/Lain-ascii-220.png
```

## 主要参数

- `--columns 120`：横向采样字符数；数值越大，细节越多，SVG 文件也越大。
- `--sample-size 3`：按“每个字符约采样多少源像素”设置精度；与 `--columns` 二选一，数值越小越细。
- `--ramp "@%#*+=-:."`：由深到浅的字符表。
- `--gamma 1`：只调整字符密度映射；大于 `1` 会整体使用更密的字符，不改变采样颜色。
- `--alpha-threshold 4`：忽略几乎不可见的采样点；设为 `0` 可保留所有非零 Alpha。
- `--cell-width 10 --cell-height 18 --font-size 17`：字符网格与字体尺寸。
- `--png-scale 2`：PNG 相对 SVG 逻辑尺寸的导出倍率，不改变采样细节。
- `--invert`：反转字符明暗映射。

`--columns` 决定图像信息量，`--png-scale` 只决定最终位图尺寸。海报中优先放置 SVG；若排版软件对 SVG 字体替换不稳定，则使用脚本同步生成的 PNG。
