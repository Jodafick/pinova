#!/usr/bin/env python3
"""Normalise onboarding.enterFotoce → marque Fotoce (non traduite)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DIRS = [
    ROOT / "FOTOCE-FRONTEND" / "src" / "i18n" / "locales",
    ROOT / "Fotoce-Mobile" / "src" / "i18n" / "locales",
]

# Verbe d'entrée par code langue (marque Fotoce invariable)
ENTER: dict[str, str] = {
    "fr": "Entrez Fotoce",
    "en": "Enter Fotoce",
    "es": "Entra en Fotoce",
    "de": "Fotoce öffnen",
    "it": "Entra in Fotoce",
    "pt": "Entrar no Fotoce",
    "ar": "ادخل Fotoce",
    "zh": "进入 Fotoce",
    "ja": "Fotoce を開く",
    "ko": "Fotoce 시작",
    "hi": "Fotoce खोलें",
    "ru": "Войти в Fotoce",
    "uk": "Увійти в Fotoce",
    "pl": "Wejdź do Fotoce",
    "nl": "Open Fotoce",
    "tr": "Fotoce'ya gir",
    "vi": "Vào Fotoce",
    "th": "เข้า Fotoce",
    "he": "היכנס ל-Fotoce",
    "fa": "وارد Fotoce شوید",
    "el": "Μπείτε στο Fotoce",
    "sv": "Öppna Fotoce",
    "da": "Åbn Fotoce",
    "no": "Åpne Fotoce",
    "fi": "Avaa Fotoce",
    "cs": "Otevřít Fotoce",
    "ro": "Deschide Fotoce",
    "hu": "Fotoce megnyitása",
    "bn": "Fotoce খুলুন",
    "ta": "Fotoce-ஐ திற",
    "te": "Fotoce తెరవండి",
    "mr": "Fotoce उघडा",
    "gu": "Fotoce ખોલો",
    "pa": "Fotoce ਖੋਲ੍ਹੋ",
    "ml": "Fotoce തുറക്കുക",
    "km": "បើក Fotoce",
    "my": "Fotoce ကိုဖွင့်ပါ",
    "kk": "Fotoce ашу",
    "mn": "Fotoce нээх",
    "ne": "Fotoce खोल्नुहोस्",
    "ur": "Fotoce کھولیں",
    "sw": "Fungua Fotoce",
    "ha": "Buɗe Fotoce",
    "ig": "Banye Fotoce",
    "yo": "Ṣí Fotoce",
    "zu": "Vula i-Fotoce",
    "xh": "Vula i-Fotoce",
    "ca": "Obre Fotoce",
    "gl": "Abrir Fotoce",
    "eu": "Ireki Fotoce",
    "id": "Buka Fotoce",
    "fon": "Yi Fotoce",
    "wo": "Enter Fotoce",
    "bm": "Enter Fotoce",
    "ln": "Enter Fotoce",
    "dyu": "Enter Fotoce",
    "ee": "Open Fotoce",
}

LINE = re.compile(r"^(\s*'onboarding\.enterFotoce':\s*')([^']*)('.*)$")


def main() -> None:
    n = 0
    for d in DIRS:
        for f in sorted(d.glob("*.ts")):
            code = f.stem
            val = ENTER.get(code, "Enter Fotoce")
            lines = f.read_text(encoding="utf-8").splitlines(keepends=True)
            out = []
            changed = False
            for line in lines:
                m = LINE.match(line.rstrip("\n\r"))
                if m and m.group(2) != val:
                    out.append(f"{m.group(1)}{val}{m.group(3)}\n")
                    changed = True
                else:
                    out.append(line)
            if changed:
                f.write_text("".join(out), encoding="utf-8")
                print(f"fixed enterFotoce: {f.name}")
                n += 1
    print(f"{n} fichiers corrigés")


if __name__ == "__main__":
    main()
