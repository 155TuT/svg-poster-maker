# Lain 彩色 ASCII 主视觉

这是一个独立的 SVG 小元素项目。`Lain-ascii.svg` 与 `Lain-ascii-fine.svg` 是可直接编辑的视觉源文件；脚本只读取 SVG 并向 `output/png/` 导出 PNG，不再向 `output/svg/` 重复导出 SVG。

## 文件

- `Lain.webp`：最初用于制作 ASCII 主视觉的原始图片，保持不变。
- `Lain-ascii.svg`：默认精度的可编辑 SVG。
- `Lain-ascii-fine.svg`：180 列精细版可编辑 SVG。
- `render-ascii.mjs`：将指定 SVG 渲染为透明 PNG。
- `verify-ascii.mjs`：检查 SVG 字符结构和 PNG 透明像素。
- `output/png/Lain-ascii.png`：默认版 PNG。
- `output/png/Lain-ascii-fine.png`：精细版 PNG。

## 使用

首次使用：

```powershell
npm.cmd --prefix svg-poster-maker\design\lain install
```

导出并验证默认版：

```powershell
npm.cmd --prefix svg-poster-maker\design\lain run check
```

导出并验证精细版：

```powershell
npm.cmd --prefix svg-poster-maker\design\lain run check:fine
```

也可以指定其他可编辑 SVG 和输出路径：

```powershell
node svg-poster-maker\design\lain\render-ascii.mjs --svg Lain-ascii-fine.svg --png output/png/Lain-ascii-fine.png --png-scale 2
```

`node_modules/` 与 `output/` 由仓库根目录的 `.gitignore` 统一忽略。
