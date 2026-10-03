# West2 Online 袋子徽标面

`logo_page.svg` 是最终拼装的编辑源，`styles/logo_page.css` 保存底层的颜色与透明度。`logo_page.mjs` 读取它们和引用的图片，只向 `output/` 导出，不重建或覆盖编辑源。

## 拼装层次

从下到上依次为：

1. `assets/bg/output/image-halftone.png`：背景铺满 1149 × 1369 的画布，沿用原图比例。
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
