#!/usr/bin/env python3
"""
Rebrand user-facing locale strings: Fotoce → Fotoce, foto/Pins → Foto/Fotos (marque, non traduite).
Ne modifie pas les clés i18n ni les placeholders {foto_id}, {pins}, etc.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCALE_DIRS = [
    ROOT / "src" / "i18n" / "locales",
    ROOT.parent / "Fotoce-Mobile" / "src" / "i18n" / "locales",
]

# Termes traduits « foto » par langue → marque Foto/Fotos (ordre : pluriel avant singulier)
LANG_PIN_TERMS: list[tuple[str, str]] = [
    # FR
    ("épingles", "Fotos"),
    ("Épingles", "Fotos"),
    ("épinglette", "Foto"),
    ("Épinglette", "Foto"),
    ("épinglez", "Foto"),  # « épinglez les détails » → contexte partiel
    ("épingle", "Foto"),
    ("Épingle", "Foto"),
    # ES
    ("Alfileres", "Fotos"),
    ("Alfiler", "Foto"),
    ("alfileres", "Fotos"),
    ("alfiler", "Foto"),
    ("pines", "Fotos"),
    ("Pines", "Fotos"),
    # IT
    ("spilli", "Fotos"),
    ("Spilli", "Fotos"),
    ("spillo", "Foto"),
    ("Spillo", "Foto"),
    # PT
    ("alfinetes", "Fotos"),
    ("Alfinetes", "Fotos"),
    ("alfinete", "Foto"),
    ("Alfinete", "Foto"),
    # NL
    ("spelden", "Fotos"),
    ("speld", "Foto"),
    # PL
    ("pinezki", "Fotos"),
    ("pinezka", "Foto"),
    # RU
    ("пины", "Fotos"),
    ("пин", "Foto"),
    ("Пин", "Foto"),
    # TR
    ("pinler", "Fotos"),
    # Generic EN brand terms (appliqué à toutes les locales)
    ("Repins", "Refotos"),
    ("Repin", "Refoto"),
    ("repins", "refotos"),
    ("repin", "refoto"),
    ("Re-pin", "Re-Foto"),
    ("re-pin", "re-Foto"),
    ("Multi-Pin", "Multi-Foto"),
    ("multi-pins", "multi-Fotos"),
    ("multi-pins", "multi-Fotos"),
    ("Multi-pin", "Multi-Foto"),
    ("Pins", "Fotos"),
    ("Foto", "Foto"),
    ("fotos", "Fotos"),
    ("pin", "Foto"),
]

# Corrections ciblées (clé → nouvelle valeur ou pattern)
FIXES: dict[str, str] = {
    "pin.a11y.unlike": "Retirer mon like de cette Foto",
    "create.step1.banner": "Étape 1 sur 2 — détails de la Foto.",
    "checkout.return.boost.desc": "Votre Foto sera promue une fois le paiement confirmé.",
    "checkout.activation.sub.success.boost": "Votre Foto sera promue une fois la validation terminée.",
}


def rebrand_value(text: str, key: str = "") -> str:
    if key in FIXES:
        return FIXES[key]

    # Marque application
    text = text.replace("FOTOCE", "FOTOCE")
    text = text.replace("Fotoce", "Fotoce")
    # fotoce en minuscules dans les textes (pas dans les clés — géré en amont)
    text = re.sub(r"\bfotoce\b", "Fotoce", text)

    # Termes foto traduits / anglais
    for old, new in LANG_PIN_TERMS:
        text = text.replace(old, new)

    # « PIN » allemand/confusion code secret → Foto quand c'est le contenu
    text = re.sub(
        r"\bPIN\b(?!\s*code|\s*\d)",
        "Foto",
        text,
    )

    return text


LINE_RE = re.compile(
    r"^(\s*'([^']+)':\s*)('(?:\\'|[^'])*'|`(?:\\`|[^`])*`|\"(?:\\\"|[^\"])*\")(.*)$"
)


def process_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    lines_out: list[str] = []
    changed = False

    for line in original.splitlines(keepends=True):
        m = LINE_RE.match(line.rstrip("\n\r"))
        if not m:
            lines_out.append(line)
            continue
        prefix, key, quoted, suffix = m.groups()
        quote = quoted[0]
        raw = quoted[1:-1]
        # Décoder échappements simples
        unescaped = raw.replace("\\'", "'").replace('\\"', '"').replace("\\`", "`")
        new_val = rebrand_value(unescaped, key)
        if new_val != unescaped:
            changed = True
            escaped = new_val.replace("'", "\\'")
            lines_out.append(f"{prefix}'{escaped}'{suffix}\n")
        else:
            lines_out.append(line)

    if changed:
        path.write_text("".join(lines_out), encoding="utf-8")
    return changed


def main() -> None:
    total = 0
    for loc_dir in LOCALE_DIRS:
        if not loc_dir.is_dir():
            print(f"skip (missing): {loc_dir}")
            continue
        for ts in sorted(loc_dir.glob("*.ts")):
            if process_file(ts):
                print(f"updated: {ts.relative_to(ROOT.parent)}")
                total += 1
    print(f"Done — {total} fichier(s) modifié(s).")


if __name__ == "__main__":
    main()
