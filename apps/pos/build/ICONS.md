# App Icons

Place your Compazz POS app icons here before building:

| File | Format | Size | Used By |
|------|--------|------|---------|
| `icon.ico` | ICO | 256x256 (multi-size) | Windows installer + taskbar |
| `icon.icns` | ICNS | 512x512 (multi-size) | macOS app icon |
| `icon.png` | PNG | 512x512 | Linux app icon |

## How to generate

1. Start with a **512x512 PNG** of the Compazz logo
2. Use https://icoconvert.com to create the `.ico` (include 16, 32, 48, 128, 256 sizes)
3. Use https://cloudconvert.com/png-to-icns to create the `.icns`
4. Keep the original `.png` as-is for Linux

Without these files, electron-builder will use a default blank icon.
