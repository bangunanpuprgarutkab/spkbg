# PWA Icons Setup

## File yang dibutuhkan

Untuk PWA berfungsi dengan optimal, siapkan file icon berikut di folder `/public/img/`:

### Wajib ada:
- `icon-192x192.png` - Icon untuk home screen (192x192px)
- `icon-512x512.png` - Icon splash screen & install (512x512px)
- `icon.png` - Favicon (32x32px atau 64x64px)
- `icon.svg` - Sudah dibuat (source untuk generate PNG)

### Optional:
- `apple-touch-icon.png` - Untuk iOS (180x180px)
- `masked-icon.svg` - Untuk adaptive icons Android
- `favicon.ico` - Untuk browser lama

## Cara Generate PNG dari SVG

### Opsi 1: Online Converter
1. Buka https://convertio.co/svg-png/ atau https://cloudconvert.com/svg-to-png
2. Upload `icon.svg`
3. Download PNG dengan ukuran yang diperlukan

### Opsi 2: Menggunakan Node.js (jika ImageMagick terinstall)
```bash
npx svgexport public/img/icon.svg public/img/icon-192x192.png 192:192
npx svgexport public/img/icon.svg public/img/icon-512x512.png 512:512
```

### Opsi 3: Design Tool
- Figma: Import SVG → Export sebagai PNG (192x192 & 512x512)
- Adobe Illustrator: Export → Save for Web → PNG
- Inkscape (Gratis): File → Export PNG Image

## Validasi PWA

Setelah build, verifikasi PWA di Chrome DevTools:
1. Buka DevTools (F12)
2. Tab **Application** → **Manifest**
3. Tab **Application** → **Service Workers**
4. Tab **Lighthouse** → Run PWA audit

## Features PWA yang Aktif

✅ **Installable** - Bisa "Add to Home Screen"  
✅ **Offline Support** - Service Worker caching aktif  
✅ **Auto Update** - Service Worker auto-update  
✅ **Supabase Cache** - Network-first strategy untuk API  
✅ **Theme Color** - Status bar mengikuti tema aplikasi  

## Mobile Optimization

- **Viewport**: `width=device-width, initial-scale=1.0`
- **Touch Icons**: Apple touch icon support
- **Standalone Mode**: Berjalan tanpa browser chrome
- **Portrait Orientation**: Optimized untuk mobile portrait
