#!/usr/bin/env python3
"""
Génère les fichiers de locale à partir de en.ts via googletrans (Python).

Sauvegarde incrémentale : après chaque lot, écrit le .ts + un checkpoint JSON
(scripts/.checkpoints/) pour reprendre après interruption.

Usage:
  python scripts/generate-locales.py
  python scripts/generate-locales.py --lang es
  python scripts/generate-locales.py --mobile
  python scripts/generate-locales.py --force
  python scripts/generate-locales.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

from googletrans import Translator

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = ROOT / "src" / "i18n" / "languages.registry.ts"
DUMP_SCRIPT = ROOT / "scripts" / "dump-en-locale.mjs"
CHECKPOINT_ROOT = ROOT / "scripts" / ".checkpoints"

PLACEHOLDER_RE = re.compile(r"\{[a-zA-Z0-9_]+\}")
BATCH_SIZE = 25
DELAY_SEC = 0.15


def parse_registry(source: str) -> list[dict[str, str | None]]:
    langs: list[dict[str, str | None]] = []
    block_re = re.compile(r"\{\s*code:\s*'([^']+)'[\s\S]*?\}")
    google_re = re.compile(r"googleCode:\s*'([^']+)'")
    for block in block_re.finditer(source):
        body = block.group(0)
        code = block.group(1)
        google_match = google_re.search(body)
        langs.append({"code": code, "google_code": google_match.group(1) if google_match else None})
    return langs


def load_en_dict(locales_dir: Path) -> dict[str, str]:
    proc = subprocess.run(
        ["node", str(DUMP_SCRIPT), str(locales_dir)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Impossible de charger en.ts:\n{proc.stderr or proc.stdout}")
    if not proc.stdout:
        raise RuntimeError("en.ts export vide")
    return json.loads(proc.stdout)


def checkpoint_dir(mobile: bool) -> Path:
    return CHECKPOINT_ROOT / ("mobile" if mobile else "web")


def checkpoint_path(mobile: bool, code: str) -> Path:
    return checkpoint_dir(mobile) / f"{code}.json"


def load_checkpoint(mobile: bool, code: str, source: dict[str, str]) -> dict[str, str]:
    path = checkpoint_path(mobile, code)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return {}
        return {k: str(v) for k, v in data.items() if k in source}
    except Exception:
        return {}


def save_checkpoint(mobile: bool, code: str, translated: dict[str, str]) -> None:
    folder = checkpoint_dir(mobile)
    folder.mkdir(parents=True, exist_ok=True)
    path = checkpoint_path(mobile, code)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(translated, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def clear_checkpoint(mobile: bool, code: str) -> None:
    path = checkpoint_path(mobile, code)
    if path.exists():
        path.unlink()


def protect_placeholders(text: str) -> tuple[str, list[tuple[str, str]]]:
    tokens: list[tuple[str, str]] = []

    def repl(match: re.Match[str]) -> str:
        token_id = f"__PH_{len(tokens)}__"
        tokens.append((token_id, match.group(0)))
        return token_id

    return PLACEHOLDER_RE.sub(repl, text), tokens


def restore_placeholders(text: str, tokens: list[tuple[str, str]]) -> str:
    out = text
    for token_id, value in tokens:
        out = out.replace(token_id, value)
    return out


def googletrans_dest(google_code: str) -> str:
    return google_code.lower().replace("_", "-")


def translate_one(translator: Translator, text: str, dest: str, retries: int = 3) -> str:
    if not text.strip():
        return text
    protected, tokens = protect_placeholders(text)
    for attempt in range(retries):
        try:
            result = translator.translate(protected, src="en", dest=dest)
            if result is None:
                raise RuntimeError("reponse vide")
            raw = getattr(result, "text", None)
            if not raw:
                raise RuntimeError("texte vide")
            return restore_placeholders(str(raw), tokens)
        except Exception:
            time.sleep(0.6 * (attempt + 1))
    return text


def translate_batch(translator: Translator, texts: list[str], dest: str) -> list[str]:
    out: list[str] = []
    for text in texts:
        out.append(translate_one(translator, text, dest))
        time.sleep(0.08)
    return out


def serialize_locale(code: str, entries: dict[str, str]) -> str:
    lines = [f"export const {code}: Record<string, string> = {{"]
    for key in sorted(entries.keys()):
        value = (
            entries[key]
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\r\n", "\\n")
            .replace("\n", "\\n")
        )
        if len(value) > 72:
            lines.append(f"  '{key}':")
            lines.append(f"    '{value}',")
        else:
            lines.append(f"  '{key}': '{value}',")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def write_locale_file(out_path: Path, code: str, translated: dict[str, str]) -> None:
    out_path.write_text(serialize_locale(code, translated), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Génère les locales Pinova via googletrans")
    parser.add_argument("--lang", help="Une seule langue (ex. es)")
    parser.add_argument("--mobile", action="store_true", help="Cible Pinova-Mobile")
    parser.add_argument("--force", action="store_true", help="Écrase et régénère (ignore checkpoints)")
    parser.add_argument("--dry-run", action="store_true", help="Ne pas écrire les fichiers")
    args = parser.parse_args()

    locales_dir = (
        ROOT.parent / "Pinova-Mobile" / "src" / "i18n" / "locales"
        if args.mobile
        else ROOT / "src" / "i18n" / "locales"
    )

    registry = parse_registry(REGISTRY_PATH.read_text(encoding="utf-8"))
    source = load_en_dict(locales_dir)
    keys = list(source.keys())
    print(f"Source: {len(keys)} cles dans {locales_dir / 'en.ts'}")

    targets = [l for l in registry if l["code"] != "en" and l["google_code"]]
    if args.lang:
        targets = [l for l in targets if l["code"] == args.lang]
    elif not args.force:
        targets = [l for l in targets if l["code"] not in ("fr", "fon")]

    if args.lang and not targets:
        print(f"Langue inconnue ou sans googleCode: {args.lang}", file=sys.stderr)
        return 1

    print(f"Cibles: {len(targets)} langue(s) | checkpoint: {checkpoint_dir(args.mobile)}")
    translator = Translator()

    for lang in targets:
        code = lang["code"]
        assert lang["google_code"]
        dest = googletrans_dest(lang["google_code"])
        out_path = locales_dir / f"{code}.ts"

        if args.force:
            clear_checkpoint(args.mobile, code)

        translated = {} if args.force else load_checkpoint(args.mobile, code, source)
        pending_keys = [k for k in keys if k not in translated]

        if not pending_keys and out_path.exists() and not args.force:
            print(f"[skip] {code}.ts complet ({len(translated)} cles)")
            continue

        if translated and pending_keys:
            print(f"\n[resume] {code} — {len(translated)}/{len(keys)} deja traduites")
        else:
            print(f"\n[lang] {code} -> googletrans {dest}")

        for i in range(0, len(pending_keys), BATCH_SIZE):
            batch_keys = pending_keys[i : i + BATCH_SIZE]
            batch_texts = [source[k] for k in batch_keys]
            batch_out = translate_batch(translator, batch_texts, dest)

            for key, value in zip(batch_keys, batch_out):
                translated[key] = value

            done = len(translated)
            pct = round(done * 100 / len(keys))
            print(f"\r  {pct}% ({done}/{len(keys)})", end="", flush=True)

            if not args.dry_run:
                save_checkpoint(args.mobile, code, translated)
                write_locale_file(out_path, code, translated)

            time.sleep(DELAY_SEC)

        print()
        if args.dry_run:
            print(f"  (dry-run) {out_path}")
        else:
            write_locale_file(out_path, code, translated)
            clear_checkpoint(args.mobile, code)
            print(f"  [ok] ecrit {out_path} ({len(translated)} cles)")

    print("\nTermine.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
