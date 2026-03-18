# Clui CC — Linux Desteği Planı

## Özet
Clui CC şu an sadece macOS'a özel. Electron zaten cross-platform olduğundan, macOS'a bağımlı ~10 noktayı Linux karşılıklarıyla değiştirerek Linux desteği eklenebilir.

---

## Değişiklik Gereken Dosyalar ve Adımlar

### 1. `package.json` — Build config & scripts
- **`build` bölümüne `linux` target ekle:**
  ```json
  "linux": {
    "target": ["AppImage", "deb"],
    "icon": "resources/icon.png",
    "category": "Utility"
  }
  ```
- **`dist` script'ine Linux komutu ekle:**
  ```json
  "dist:linux": "electron-vite build --mode production && electron-builder --linux --dir"
  ```
- AppImage: Tek dosya, her distro'da çalışır, indirip çalıştır. deb: Ubuntu/Debian için.

### 2. `resources/icon.png` — Linux icon
- Linux `.icns` desteklemez, `.png` (512x512) gerekli.
- Mevcut `icon.icns`'den dönüştürülecek veya yeni bir PNG eklenecek.

### 3. `src/main/index.ts` — Ana süreç (en çok değişiklik)

#### a) Window oluşturma (satır 103-125)
- `type: 'panel'` sadece macOS NSPanel. Linux'ta kaldır.
- Linux'ta `icon` property'si `.png` olmalı.
```ts
icon: join(__dirname, '../../resources/',
  process.platform === 'darwin' ? 'icon.icns' : 'icon.png')
```

#### b) Dock gizleme (satır 864-866)
- `app.dock.hide()` sadece macOS. Linux'ta `skipTaskbar: true` zaten var, yeterli.
- Zaten `process.platform === 'darwin'` koşulu var, değişiklik gerekmez.

#### c) Screenshot (satır 568)
- `/usr/sbin/screencapture` macOS'a özel.
- Linux alternatifi: `gnome-screenshot -a -f <path>` veya `scrot -s <path>` veya `import <path>` (ImageMagick)
```ts
if (process.platform === 'darwin') {
  execSync(`/usr/sbin/screencapture -i "${screenshotPath}"`, ...)
} else {
  // Try gnome-screenshot, then scrot, then import
  execSync(`gnome-screenshot -a -f "${screenshotPath}"`, ...)
}
```

#### d) Terminal'de aç (satır 809-823)
- AppleScript/osascript macOS'a özel.
- Linux alternatifi: Yaygın terminal emülatörleri denenecek.
```ts
if (process.platform === 'darwin') {
  // mevcut AppleScript kodu
} else {
  // Try: x-terminal-emulator, gnome-terminal, konsole, xterm
  const terminals = ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xfce4-terminal', 'xterm']
  // İlk bulunanı kullan
}
```

#### e) Dialog handling (satır 481-483, 510-512)
- Zaten platform koşulu var, Linux `mainWindow` parent ile çalışır (else branch). Değişiklik gerekmez.

#### f) Keyboard shortcuts (satır 905-909)
- `Alt+Space` Linux'ta bazı WM'lerde window menu açar. Yine de denenecek, fallback `Ctrl+Shift+K` zaten var.
- `CommandOrControl+Shift+K` zaten cross-platform.

### 4. `src/main/process-manager.ts` — Claude binary bulma

#### a) Binary arama yolları (satır 40-45)
- `/opt/homebrew/bin/claude` macOS'a özel.
- Linux yolları ekle: `/usr/bin/claude`, `~/.local/bin/claude`
```ts
const candidates = [
  '/usr/local/bin/claude',
  ...(process.platform === 'darwin'
    ? ['/opt/homebrew/bin/claude']
    : ['/usr/bin/claude', join(homedir(), '.local/bin/claude')]),
  join(homedir(), '.npm-global/bin/claude'),
]
```

#### b) Login shell PATH (satır 113)
- `/bin/zsh -lc "echo $PATH"` — Linux'ta zsh olmayabilir.
- Bash fallback zaten var ama önce zsh deniyor. Linux'ta sırayı değiştir.
```ts
const shell = process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'
this._loginShellPath = execSync(`${shell} -lc "echo $PATH"`, ...).trim()
```

### 5. `src/main/index.ts` — Whisper yolları (satır 647-668)
- Homebrew yolları macOS'a özel.
- Linux yolları ekle:
```ts
const candidates = [
  ...(process.platform === 'darwin'
    ? ['/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli',
       '/opt/homebrew/bin/whisper', '/usr/local/bin/whisper']
    : ['/usr/bin/whisper', '/usr/local/bin/whisper',
       '/usr/bin/whisper-cli', '/usr/local/bin/whisper-cli']),
  join(homedir(), '.local/bin/whisper'),
]
```
- Model yolları da güncelle (Linux'ta `/usr/share/whisper-cpp/models/` vb.)
- `whence -p` zsh-only; Linux'ta `which` kullan.

### 6. `scripts/doctor.sh` — Platform-aware diagnostics
- macOS check'ini Linux'a da genişlet:
```bash
if [ "$(uname)" = "Darwin" ]; then
  # mevcut macOS kontrolleri
elif [ "$(uname)" = "Linux" ]; then
  check "Linux" "1" "$(uname -r)"
  # gcc/g++ kontrolü (clang++ yerine veya ek olarak)
  # Xcode CLT kontrolü kaldır, build-essential kontrol et
fi
```

### 7. `commands/install-linux.sh` — Yeni Linux installer
- Yeni dosya: `commands/install-linux.sh`
- Adımlar:
  1. Ortam kontrolü (Node, npm, gcc/g++, Claude CLI)
  2. npm install
  3. `npm run dist:linux` ile build
  4. AppImage'ı `~/.local/bin/` veya `/opt/` altına kopyala
  5. Desktop entry oluştur (`~/.local/share/applications/clui-cc.desktop`)
  6. Başlat

### 8. `install-linux.sh` — Root-level wrapper
- Root'ta `install-linux.sh` → `commands/install-linux.sh`'a yönlendir.

### 9. `clui-cc.desktop` — Desktop entry dosyası
```ini
[Desktop Entry]
Name=Clui CC
Comment=Claude Code UI Overlay
Exec=AppImage-path
Icon=icon-path
Type=Application
Categories=Utility;Development;
```

---

## Uygulama Sırası

1. `resources/icon.png` ekle (icns'den dönüştür veya mevcut tray icon'dan büyüt)
2. `package.json` güncelle (linux build config + dist:linux script)
3. `src/main/index.ts` güncelle (tüm platform-specific kodlar)
4. `src/main/process-manager.ts` güncelle (binary arama + shell PATH)
5. `scripts/doctor.sh` güncelle (Linux kontrolleri)
6. `commands/install-linux.sh` oluştur
7. `install-linux.sh` root wrapper oluştur
8. Test et (electron-builder --linux)

---

## Riskler & Notlar
- **Şeffaf pencere**: Bazı Linux WM/compositor'larda (özellikle Wayland) transparency sorunlu olabilir. X11'de genelde çalışır.
- **Always on top**: Tiling WM'lerde (i3, sway) farklı davranabilir.
- **Global shortcut**: Wayland'da global shortcut API'si kısıtlı. X11'de çalışır.
- **node-pty**: Linux'ta prebuilt binary'si var, sorun olmamalı.
- **Whisper**: Linux'ta `whisper-cpp` paket yöneticisinden veya source'dan kurulabilir.
