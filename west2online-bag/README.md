# West2 Online 袋子页面

`logo_page.svg` 是最终拼装的编辑源，`styles/logo_page.css` 保存底层的颜色与透明度。`logo_page.mjs` 读取它们和引用的图片，只向 `output/` 导出，不重建或覆盖编辑源。

标语面使用对应的 `slogan_page.svg`、`styles/slogan_page.css` 与 `slogan_page.mjs`，主体内容独立放在 `assets/sloganbody/sloganbody.svg`。遮罩顶部为“我在西二”，底部为“为你在线”，“西二”和“在线”使用 `#F99C1A`。上下稿线连通，中间沿中线依次排列 AI、前端、Java、Golang、Unity、设计、安卓，并各配短稿线。

## Logo 面拼装层次

从下到上依次为：

1. `assets/logo_page_bg/output/image-halftone.png`：背景铺满 1149 × 1369 的画布，沿用原图比例。
2. 暖白色 `#fffdf7` 底层：不透明度为 76%，尺寸与主体相同。
3. `assets/mainbody/output/mainbody.png`：直接使用已完成波点处理的主体成品。

底层与主体位于 `mainbody-placement` 同一组，均以 1008 × 1424 为局部坐标，缩放到 64%，显示尺寸为 645.12 × 911.36。组合中心与画布中心重合，四周不裁切。修改组上的 `scale(0.64)` 可一起缩放，修改第一个 `translate(574.5 684.5)` 可一起移动。

## 导出

在本目录运行：

```powershell
npm install
npm run build
```

`npm run render` 与 `npm run build` 等价，均只导出当前 SVG。可用 `npm run build -- --scale 1` 导出画布原尺寸 PNG，默认是 2 倍尺寸。

| 文件 | 用途 |
| --- | --- |
| `logo_page.svg` | 编辑构图与图片引用；保留易读的相对路径 |
| `styles/logo_page.css` | 编辑暖白底层的颜色与透明度 |
| `logo_page.mjs` | 读取 SVG、内嵌样式和图片、导出文件 |
| `output/logo_page.svg` | 图片与样式已内嵌，可独立查看、移动或交付 |
| `output/logo_page.png` | 最终拼装图，默认 2298 × 2738 |
| `output/logo_page-preview.png` | 800 像素宽的预览图 |

画布单位为像素，尚未设置袋子的实际印刷尺寸或出血。放大导出不会增加背景原图的细节。

## 修改主体文字

主体内容仍在 `assets/mainbody/mainbody.svg` 中编辑，小字保留可编辑文本。修改后先在 `assets/mainbody` 运行 `npm run build`，更新主体 PNG，再回到本目录运行 `npm run build` 完成拼装。最终页面按照要求引用主体 PNG，文字编辑应在主体 SVG 中进行。

背景与主体的波点效果由各自的资产流程处理。最终拼装不会再次进行波点处理。主体导出的中间图片使用系统临时目录并在结束时自动清理，流程无需保留仓库中的 `tmp/` 目录。

## 生成两面的波点背景

在本目录运行：

```powershell
npm run build:bg:logo
npm run build:bg:slogan
```

两条命令分别读取 `assets/logo_page_bg/image.png` 和 `assets/slogan_page_bg/image.png`，输出到各自的 `output/`：`image-halftone.png` 为完整背景，`image-halftone-ink.png` 为透明油墨层。原图保留不变。

两面共用 `assets/logo_page_bg/halftone.cjs` 中的同一套算法与默认参数，slogan 目录的脚本只负责指定本目录的输入与输出。默认使用原色网点、45° 网格，点距随原图宽度等比例变化。参数说明见两个背景目录的 README；例如 `npm run build:bg:slogan -- --spacing 10` 可调整 slogan 背景的点距。

更新 logo 背景后，再运行 `npm run build` 刷新最终拼装。slogan 页读取手工裁好的 `assets/slogan_page_bg/output/image-halftone-after-cut.png`；背景波点命令只更新未裁切背景和透明油墨层，手工裁图需单独更新。

## Slogan 面底稿

`slogan_page.svg` 引用裁后背景 `assets/slogan_page_bg/output/image-halftone-after-cut.png`，将其从 1054 × 1255 按目标宽高放大铺满 1149 × 1369 画布，保留裁图文件。画布、默认导出分辨率与 logo 页一致。

遮罩与标语主体位于独立的 `sloganbody-placement` 分组，几何参数与 logo 页一致：以 1008 × 1424 为局部坐标、缩放到 64%，显示为 645.12 × 911.36，左上角位于 `(251.94, 228.82)`，中心为 `(574.5, 684.5)`。`styles/slogan_page.css` 的 `.sloganbody-underlay` 使用暖白色 `#fffdf7` 与 76% 不透明度。

在本目录运行：

```powershell
npm run build:slogan
```

`npm run render:slogan` 与其等价；加上 `-- --scale 1` 可导出 1149 × 1369 PNG，默认 2 倍导出为 2298 × 2738。也可从仓库根目录运行 `node .\west2online-bag\slogan_page.mjs`，默认路径不受运行位置影响。

| 文件 | 用途 |
| --- | --- |
| `slogan_page.svg` | 拼装背景、遮罩与 `assets/sloganbody/sloganbody.svg` |
| `assets/sloganbody/sloganbody.svg` | 独立编辑上下标语、连通稿线及中部七个组名与短稿线 |
| `styles/slogan_page.css` | 编辑页面遮罩颜色与透明度 |
| `slogan_page.mjs` | 读取当前 SVG、内嵌样式与图片，只写入 `output/` |
| `output/slogan_page.svg` | 图片与样式已内嵌，可独立查看、移动或交付 |
| `output/slogan_page.png` | 默认 2298 × 2738 的完整 PNG |
| `output/slogan_page-preview.png` | 800 像素宽的预览图 |

上下标语与稿线在 `assets/sloganbody/sloganbody.svg` 中编辑；七个组名位于其 `slogan-middle-content` 分组，使用 90 px 思源宋体 Heavy，字形中心间距 128，短稿线各向字形两侧延长 90。字号与间距的计算见主体目录 README。页面脚本直接读取并内嵌该主体 SVG，无需先生成主体 PNG。遮罩的透明度只应用于矩形，主体内容单独控制透明度。
