# Java 组纳新海报

## 文件

- `poster_without_qrcode.png`：不含二维码的完整海报底图，保持原样。
- `qrcode/raw_qrcode.jpg`：QQ 群二维码源图；扩展名为 JPG，实际编码为 PNG。
- `qrcode/process-qrcode.mjs`：自动识别并裁切二维码矩阵，移除深色卡片背景，将码点改为海报主蓝，并保留白色中心 QQ 标识。
- `qrcode/qrcode-java-styled.png`：处理后的透明底二维码，由脚本生成。
- `chemical-engineering-logo-source.png`：化工学院标识原图备份，保持原样。
- `process-white-logo.mjs`：移除标识近白背景并把所有可见前景统一为纯白，保留透明抗锯齿。
- `chemical-engineering-logo-white.png`：透明底白色标识，由脚本生成。
- `output/png/chemical-engineering-logo-white-preview.png`：仅用于检查白色标识轮廓的深色底预览图。
- `java-recruitment.svg`：嵌入底图和二维码的自包含 SVG，由脚本生成；图像节点通过 `data-source-path` 记录对应资源路径。
- `render-poster.mjs`：同步二维码与 SVG，并导出 PNG/PDF。
- `qrcode/verify-qrcode.mjs`：分别解码处理后的二维码和导出海报中的二维码，确认内容一致。
- `output/png/java-recruitment-preview.png`：`1024 x 1536 px` 屏幕预览图。
- `output/png/java-recruitment.png`：`2480 x 3720 px`、300 dpi PNG，对应 `210 x 315 mm` 的 2:3 版式。
- `output/pdf/java-recruitment.pdf`：单页 `210 x 315 mm` PDF。

## 使用

首次使用：

```powershell
npm.cmd --prefix svg-poster-maker\java install
```

同步素材并导出：

```powershell
npm.cmd --prefix svg-poster-maker\java run render
```

验证二维码：

```powershell
npm.cmd --prefix svg-poster-maker\java run verify:qr
```

完整重建并验证：

```powershell
npm.cmd --prefix svg-poster-maker\java run check
```

如果只需重新生成透明底二维码：

```powershell
npm.cmd --prefix svg-poster-maker\java run process:qr
```

重新生成透明底白色化工学院标识：

```powershell
npm.cmd --prefix svg-poster-maker\java run process:logo
```

## 版式约束

SVG 的画布和底图保持 `1024 x 1536`，不改变原海报内容。二维码图层位于
`x=82, y=992`，显示尺寸为 `376 x 376`；透明 quiet zone 让实际码点落在“加入我们”白框内，并避开底部群号。二维码处理脚本会校验识别到的码点区域近似正方形，源截图结构发生明显变化时会直接报错，避免静默裁错。
