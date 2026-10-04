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

导出目录按页面和版本组织，沿用已经创建好的文件夹：

```text
output/
├─ logo_page/
│  ├─ origin/             原始比例版本
│  ├─ 260x360mm_origin/   260 × 360 mm，保留背景纸色
│  └─ 260x360mm_ink/      260 × 360 mm，透明背景油墨层
└─ slogan_page/
   ├─ origin/
   ├─ 260x360mm_origin/
   └─ 260x360mm_ink/
```

`npm run build` 写入 `output/logo_page/origin/`，`npm run build:slogan` 写入 `output/slogan_page/origin/`；`npm run build:print` 一次生成两面的两种印刷版。`npm run build:all` 依次完成全部导出。导出文件不再散落在 `output/` 根目录。

| 文件 | 用途 |
| --- | --- |
| `logo_page.svg` | 编辑构图与图片引用；保留易读的相对路径 |
| `styles/logo_page.css` | 编辑暖白底层的颜色与透明度 |
| `logo_page.mjs` | 读取 SVG、内嵌样式和图片、导出文件 |
| `output/logo_page/origin/logo_page.svg` | 图片与样式已内嵌，可独立查看、移动或交付 |
| `output/logo_page/origin/logo_page.png` | 最终拼装图，默认 2298 × 2738 |
| `output/logo_page/origin/logo_page-preview.png` | 800 像素宽的预览图 |

以上原版画布单位为像素。另有下方的 260 × 360 mm 印刷版；原版命令与文件继续保留。放大导出不会增加背景原图的细节。

## 260 × 360 mm 印刷版

独立编辑源 `logo_page_260x360mm.svg` 与 `slogan_page_260x360mm.svg` 的构图依据此前提供的 `logo_page_13x18.png`、`slogan_page_13x18.png` 确定，导出不依赖参考图仍在目录中。原页面与背景资产继续保留。印刷源以 **毫米** 为坐标单位，成品范围为 `(0, 0, 260, 360)`；四边各留 **3 mm 出血**，交付画布为 **266 × 366 mm**，SVG 的 `viewBox` 为 `-3 -3 266 366`。

在本目录运行：

```powershell
npm run build:print
```

默认导出 300 dpi、sRGB 的 PNG，并写入分辨率元数据；可用 `npm run build:print -- --dpi 600` 调整导出分辨率。结果分别写入每面的 `260x360mm_origin/` 和 `260x360mm_ink/`，原始比例版本由独立命令维护。

有纸色版文件名以 `logo_page_260x360mm` / `slogan_page_260x360mm` 开头；透明油墨版再加 `_ink`。以下 `{版名}` 指对应前缀。

| 各版本目录中的输出文件 | 用途与尺寸 |
| --- | --- |
| `{版名}_bleed3mm.png` | 含出血印刷图，266 × 366 mm，300 dpi 时为 **3142 × 4323 px** |
| `{版名}_bleed3mm.svg` | 同尺寸交付 SVG，图片与样式内嵌 |
| `{版名}.png` | 成品裁切图，260 × 360 mm，300 dpi 时为 **3071 × 4252 px** |
| `{版名}.svg` | 同尺寸成品 SVG |
| `{版名}-preview.png` | 800 px 宽成品预览；ink 版保留透明通道 |
| `{版名}-kraft-preview.png` | 仅 ink 版提供的牛皮纸底色示意，不用于印刷 |
| `{版名}-background-bleed.png` | 背景延展资产，非独立印刷交付图 |
| `print-spec.json` | 本版本的尺寸、出血、分辨率、透明度、背景裁框及主体中心记录 |

印刷交付使用带 `_bleed3mm` 的文件，以 100% 实际尺寸放置，成品线位于每条画布边缘内侧 3 mm；裁后是 260 × 360 mm。PNG 像素尺寸按毫米和 dpi 四舍五入，精确物理尺寸以 SVG 为准。导出图内不绘制裁切辅助线。

### 透明背景油墨版

两面的 `260x360mm_ink/` 分别直接使用 `assets/logo_page_bg/output/image-halftone-ink.png` 和 `assets/slogan_page_bg/output/image-halftone-ink.png`，不从有纸色成图中抠色。保留原油墨颜色和网点间的透明通道，不铺入背景纸色，也不重新生成波点。**主体、文字、位置和 76% 暖白遮罩均保留**；变化仅限背景层。

Logo 的 ink 与完整背景同为 1149 × 1369。Slogan 的 ink 原图为 1054 × 1493，为对齐现有的 1054 × 1255 手工裁图，先取 `(0, 2, 1054, 1255)`：上、中、下三段的像素匹配均定位至原图约 `y=2`。之后两面共用原印刷版的毫米映射、左右裁切和上下出血延展，主体中心仍为 `(130, 180) mm`。原 ink 文件和手工裁图不被覆盖。

`print_pages.mjs` 从同一份印刷编辑源生成两种背景版本，导出的 ink SVG 内嵌透明背景资产，PNG 同样保留 alpha。`-kraft-preview.png` 仅将透明成品叠在统一的 `#b58b5d` 底色上帮助查看；印刷文件本身不包含这层模拟纸色。

### 背景取景与主体居中

两张参考图都是 1978 × 2738 px，与精确 13:18 的宽度相差不足 1 px。印刷版保留各自的取景中心和全部高度，仅对左右各作约 0.28 px 的微调以满足精确成品比例。以原 1149 × 1369 页面坐标表示：

| 页面 | 背景裁框 `(x, y, width, height)` | 主体相对参考裁图的移动 |
| --- | --- | --- |
| Logo | `(133.138888889, 0, 988.722222222, 1369)` | 向右约 13.94 mm |
| Slogan | `(126.138888889, 0, 988.722222222, 1369)` | 向右约 12.10 mm |

Logo 参考裁框通过像素匹配定位至原 2 倍导出图的约 `x=266`；Slogan 参考裁框与原图的 `(252, 0, 1978, 2738)` 区域像素一致。背景通过 SVG 画布裁切，不重新生成波点。左右出血使用原图余量；由于参考取景已经用满底图高度，上下各 3 mm 仅在成品线外使用边缘镜像延展，成品内部取景保持不变。

两面 body 均保留原来的主体/背景比例，主体与暖白遮罩一起居中，中心为 **(130, 180) mm**，显示尺寸约为 **169.64 × 239.66 mm**。左右留白各约 **45.18 mm**，上下各约 **60.17 mm**。标语内容仍在 `assets/sloganbody/sloganbody.svg` 中编辑；SVG 保留可编辑文字，跨机器使用相同的思源宋体 Heavy 可保持字形。印刷 PNG 已固定字形。

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
| `output/slogan_page/origin/slogan_page.svg` | 图片与样式已内嵌，可独立查看、移动或交付 |
| `output/slogan_page/origin/slogan_page.png` | 默认 2298 × 2738 的完整 PNG |
| `output/slogan_page/origin/slogan_page-preview.png` | 800 像素宽的预览图 |

上下标语与稿线在 `assets/sloganbody/sloganbody.svg` 中编辑；七个组名位于其 `slogan-middle-content` 分组，使用 90 px 思源宋体 Heavy，字形中心间距 128，短稿线各向字形两侧延长 90。字号与间距的计算见主体目录 README。页面脚本直接读取并内嵌该主体 SVG，无需先生成主体 PNG。遮罩的透明度只应用于矩形，主体内容单独控制透明度。
