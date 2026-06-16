#!/usr/bin/env python3
"""Passe 2 : chaînes multilignes, FOTOCE restants, termes FR/EN non traités."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCALE_DIRS = [
    ROOT / "src" / "i18n" / "locales",
    ROOT.parent / "Fotoce-Mobile" / "src" / "i18n" / "locales",
]

PLACEHOLDERS = [
    ("{pins}", "__PH_PINS__"),
    ("{foto_id}", "__PH_PIN_ID__"),
    ("{fotoCount}", "__PH_PIN_COUNT__"),
    ("{fotoSlug}", "__PH_PIN_SLUG__"),
]

FR_TERMS = [
    ("épingles", "Fotos"),
    ("Épingles", "Fotos"),
    ("épinglette", "Foto"),
    ("Épinglette", "Foto"),
    ("épingle", "Foto"),
    ("Épingle", "Foto"),
]

EN_TERMS = [
    ("Repins", "Refotos"),
    ("Repin", "Refoto"),
    ("Multi-Pin", "Multi-Foto"),
    ("multi-pins", "multi-Fotos"),
    ("Pins", "Fotos"),
    ("Foto", "Foto"),
    ("fotos", "Fotos"),
    ("pin", "Foto"),
]

FR_GRAMMAR = [
    ("l'Foto", "la Foto"),
    ("L'Foto", "La Foto"),
    ("d'Foto", "de Foto"),
    ("Modifier l'Foto", "Modifier la Foto"),
]


def protect(text: str) -> str:
    for orig, ph in PLACEHOLDERS:
        text = text.replace(orig, ph)
    return text


def restore(text: str) -> str:
    for orig, ph in PLACEHOLDERS:
        text = text.replace(ph, orig)
    return text


def transform_value(val: str) -> str:
    val = val.replace("FOTOCE", "FOTOCE").replace("Fotoce", "Fotoce")
    val = re.sub(r"\bfotoce\b", "Fotoce", val)
    for old, new in FR_TERMS + EN_TERMS:
        val = val.replace(old, new)
    val = protect(val)
    val = re.sub(r"\bpins\b", "Fotos", val)
    val = re.sub(r"\bpin\b", "Foto", val)
    val = restore(val)
    for old, new in FR_GRAMMAR:
        val = val.replace(old, new)
    return val


KEY_LINE = re.compile(r"^(\s*'[^']+':\s*)('(?:\\'|[^'])*'|`(?:\\`|[^`])*`)?(.*)$")
CONT_LINE = re.compile(r"^(\s*)('(?:\\'|[^'])*')(.*)$")


def process_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    lines = original.splitlines(keepends=True)
    out: list[str] = []
    pending_key = False
    changed = False

    for line in lines:
        km = KEY_LINE.match(line.rstrip("\n\r"))
        if km:
            prefix, quoted, suffix = km.groups()
            suffix = suffix or ""
            if quoted:
                q = quoted[0]
                inner = quoted[1:-1].replace("\\'", "'")
                new_inner = transform_value(inner)
                if new_inner != inner:
                    changed = True
                    escaped = new_inner.replace("'", "\\'")
                    out.append(f"{prefix}'{escaped}'{suffix}\n")
                else:
                    out.append(line)
                pending_key = False
            else:
                out.append(line)
                pending_key = True
            continue

        if pending_key:
            cm = CONT_LINE.match(line.rstrip("\n\r"))
            if cm:
                indent, quoted, suffix = cm.groups()
                inner = quoted[1:-1].replace("\\'", "'")
                new_inner = transform_value(inner)
                if new_inner != inner:
                    changed = True
                    escaped = new_inner.replace("'", "\\'")
                    out.append(f"{indent}'{escaped}'{suffix}\n")
                else:
                    out.append(line)
                if suffix.rstrip().endswith(","):
                    pending_key = False
                continue

        out.append(line)

    if changed:
        path.write_text("".join(out), encoding="utf-8")
    return changed


def main() -> None:
    n = 0
    for d in LOCALE_DIRS:
        if not d.is_dir():
            continue
        for f in sorted(d.glob("*.ts")):
            if process_file(f):
                print(f"pass2: {f.relative_to(ROOT.parent)}")
                n += 1
    print(f"Pass 2 — {n} fichier(s).")


if __name__ == "__main__":
    main()
