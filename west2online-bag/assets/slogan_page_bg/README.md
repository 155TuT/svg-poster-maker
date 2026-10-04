# Slogan 面半调波点背景

`halftone.cjs` 读取同目录的 `image.png`，将结果导出到同目录的 `output/`。原图保留不变，默认输入与输出路径不受运行位置影响。

脚本直接复用 `../logo_page_bg/halftone.cjs` 的算法与默认参数：全图使用一套 45° 网格，每个网点提取原图的局部油墨色，以面积表现明暗。高光为稀疏细点，暗部网点增大并连成实墨；原图不会作为连续图像铺在下面。

默认点距为 `7.1 × 原图宽度 / 927` px，纸色为 `#f0e2cc`，覆盖率曲线 `gamma=1.2`，网点扩大率和油墨不透明度均为 1，边缘粗糙度 `grain=0.018`，抗锯齿 `samples=3`，随机种子为 2026。与 logo 背景使用同样的相对网点尺度。

在 `west2online-bag` 目录安装依赖并运行：

```powershell
npm install
npm run build:bg:slogan
```

也可以从 `west2online` 目录直接运行：

```powershell
node .\svg-poster-maker\west2online-bag\assets\slogan_page_bg\halftone.cjs
```

输出均保留原图尺寸：

- `output/image-halftone.png`：完整的波点背景。
- `output/image-halftone-ink.png`：透明油墨层，叠在 `#f0e2cc` 纸色上可重建成品。

支持与 logo 背景相同的全部参数，例如在 `west2online-bag` 目录运行：

```powershell
npm run build:bg:slogan -- --spacing 10 --dot-scale 1.1
npm run build:bg:slogan -- --help
```

显式传入的 `--input` 和 `--output` 相对于当前工作目录解析；再次运行会更新指定输出目录中的两张 PNG。完整参数与算法说明见 [logo 背景说明](../logo_page_bg/README.md)。
