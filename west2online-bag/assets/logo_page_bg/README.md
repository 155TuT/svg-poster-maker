# 半调油墨重新渲染

`halftone.cjs` 默认读取同目录的 `image.png`，把图像像素转换为油墨覆盖率，再通过网点重建整张图像，导出到同目录的 `output`。原图文件不会被改写，默认路径不受运行位置影响。

高光是细小分离的点，中间调以网点面积表现灰度，暗部网点增大、连接，直到形成实墨；极暗区域只留下少量纸色孔洞。网点统一采用 45° 网格，默认点距以 927 px 宽度时的 7.1 px 等比例换算，当前原图约为 8.8 px。

全图使用同一套网点坐标和角度。每个网点从原图的局部平均色提取一种对应的油墨色：橙色区域直接使用橙色网点，灰黑区域使用灰黑网点。每个网点内部只有这一种颜色，原图像素的亮度决定它占据多少面积。没有 CMYK 或 RGB 多色网屏，也没有多角度叠印的彩边。

每个子像素只取纸色或这个网点的油墨色，最终的中间值来自边缘抗锯齿。原图不会作为连续图像保留在结果下面。默认覆盖率曲线为 1.2，让纸张高光的点更细，保留暗部连片。

从 `west2online` 目录运行（需要 Node.js，使用已有的 `west2online-bag/node_modules/sharp`）：

```powershell
node .\svg-poster-maker\west2online-bag\assets\logo_page_bg\halftone.cjs
```

本机也可以直接使用 Codex 已有的 Node.js：

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\svg-poster-maker\west2online-bag\assets\logo_page_bg\halftone.cjs
```

输出均保留原图尺寸：

- `output/image-halftone.png`：重新印刷的完整背景。
- `output/image-halftone-ink.png`：整张图像的透明油墨印刷层；叠在 `#f0e2cc` 纸色底上可重建成品。

调整网点间距和网点扩大率：

```powershell
node .\svg-poster-maker\west2online-bag\assets\logo_page_bg\halftone.cjs --spacing 10 --dot-scale 1.1
```

`--spacing` 控制网点尺度；`--dot-scale` 按平方扩大油墨面积，会使暗部更快连成实墨。`--gamma` 大于 1 时降低覆盖率、画面更亮，小于 1 时更浓。`--opacity` 只调整重新印刷的油墨透明度，默认 1。

只使用黑色油墨，可运行：

```powershell
node .\svg-poster-maker\west2online-bag\assets\logo_page_bg\halftone.cjs --mode mono --paper '#ffffff' --ink '#292a2c' --output .\svg-poster-maker\west2online-bag\assets\logo_page_bg\output\mono
```

默认 `--mode color` 使用原图对应颜色的网点，`--mode mono` 统一使用 `--ink` 指定的油墨色。在彩色模式中，`--ink` 指定油墨色的最暗通道界限。还支持 `--angle`、`--grain`、`--samples`、`--seed`、`--input` 和 `--output`，完整参数见 `--help`。原图透明度和尺寸保留；相同原图、参数和种子得到相同结果。再次运行会更新指定目录中的这两个导出文件。

在 `west2online-bag` 目录也可运行 `npm run build:bg:logo`。`../slogan_page_bg/halftone.cjs` 直接复用本脚本导出的 `main` 和默认参数，但使用 slogan 目录自己的原图与输出；主体大字脚本则通过 `--input`、`--output` 指定临时文件。
