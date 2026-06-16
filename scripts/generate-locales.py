#!/usr/bin/env python3
"""
Génère les fichiers de locale à partir de en.ts via googletrans (Python).

Sauvegarde incrémentale : checkpoint JSON + .ts mis à jour régulièrement.
Traduction parallèle (ThreadPoolExecutor) pour accélérer.

Usage:
  python scripts/generate-locales.py
  python scripts/generate-locales.py --lang es
  python scripts/generate-locales.py --workers 12
  python scripts/generate-locales.py --force
  python scripts/generate-locales.py --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import time
from importlib.metadata import version
from pathlib import Path

from googletrans import Translator
from tqdm import tqdm

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = ROOT / "src" / "i18n" / "languages.registry.ts"
DUMP_SCRIPT = ROOT / "scripts" / "dump-en-locale.mjs"
PARSE_SCRIPT = ROOT / "scripts" / "parse-locale.mjs"
CHECKPOINT_ROOT = ROOT / "scripts" / ".checkpoints"

PLACEHOLDER_RE = re.compile(r"\{[a-zA-Z0-9_]+\}")
DEFAULT_WORKERS = min(12, max(4, (os.cpu_count() or 4) * 2))
BATCH_SIZE = 25
DELAY_SEC = 0.15
SAVE_EVERY = 40


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


def load_existing_locale(locales_dir: Path, code: str, source: dict[str, str]) -> dict[str, str]:
    """Recharge les traductions déjà écrites dans {code}.ts (reprise après clear checkpoint)."""
    out_path = locales_dir / f"{code}.ts"
    if not out_path.exists():
        return {}
    proc = subprocess.run(
        ["node", str(PARSE_SCRIPT), str(locales_dir), code],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if proc.returncode != 0 or not proc.stdout:
        return {}
    try:
        data = json.loads(proc.stdout)
        if not isinstance(data, dict):
            return {}
        return {k: str(v) for k, v in data.items() if k in source}
    except Exception:
        return {}


def load_progress(
    mobile: bool,
    code: str,
    source: dict[str, str],
    locales_dir: Path,
    *,
    force: bool,
) -> dict[str, str]:
    if force:
        return {}
    from_file = load_existing_locale(locales_dir, code, source)
    from_checkpoint = load_checkpoint(mobile, code, source)
    # Le checkpoint est plus récent que le .ts partiel en cours d'écriture.
    merged = {**from_file, **from_checkpoint}
    return merged


def atomic_write_text(path: Path, content: str, *, retries: int = 10) -> None:
    """Ecriture atomique compatible Windows (retry si fichier verrouille)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    last_err: Exception | None = None
    for attempt in range(retries):
        tmp = path.with_name(f".{path.stem}.{os.getpid()}.{attempt}.tmp")
        try:
            tmp.write_text(content, encoding="utf-8")
            if path.exists():
                try:
                    path.unlink()
                except OSError:
                    pass
            os.replace(str(tmp), str(path))
            return
        except (PermissionError, OSError) as err:
            last_err = err
            time.sleep(0.2 * (attempt + 1))
        finally:
            if tmp.exists():
                try:
                    tmp.unlink()
                except OSError:
                    pass
    try:
        path.write_text(content, encoding="utf-8")
        return
    except Exception as err:
        raise last_err or err


def save_checkpoint(mobile: bool, code: str, translated: dict[str, str]) -> None:
    path = checkpoint_path(mobile, code)
    atomic_write_text(path, json.dumps(translated, ensure_ascii=False))


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


async def translate_keys_async(
    pending_keys: list[str],
    source: dict[str, str],
    dest: str,
    translated: dict[str, str],
    key_bar: tqdm,
    *,
    mobile: bool,
    code: str,
    out_path: Path,
    dry_run: bool,
    workers: int,
) -> None:
    since_save = 0

    def persist_if_needed(force: bool = False) -> None:
        nonlocal since_save
        if dry_run:
            since_save = 0
            return
        if force or since_save >= SAVE_EVERY:
            try:
                save_checkpoint(mobile, code, translated)
                write_locale_file(out_path, code, translated)
            except (PermissionError, OSError) as err:
                tqdm.write(f"  [warn] sauvegarde {code} ignoree: {err}")
            since_save = 0

    async with Translator() as translator:
        for i in range(0, len(pending_keys), BATCH_SIZE):
            batch_keys = pending_keys[i : i + BATCH_SIZE]
            prepared: list[str] = []
            token_maps: list[list[tuple[str, str]]] = []
            originals: list[str] = []

            for key in batch_keys:
                text = source[key]
                originals.append(text)
                if not text.strip():
                    prepared.append(text)
                    token_maps.append([])
                else:
                    protected, tokens = protect_placeholders(text)
                    prepared.append(protected)
                    token_maps.append(tokens)

            results = None
            for attempt in range(3):
                try:
                    results = await translator.translate(
                        prepared,
                        dest=dest,
                        src="en",
                        list_operation_max_concurrency=workers,
                    )
                    break
                except Exception as err:
                    if attempt == 2:
                        tqdm.write(f"  [warn] lot {i // BATCH_SIZE + 1}: {err}")
                    await asyncio.sleep(0.6 * (attempt + 1))

            if not isinstance(results, list):
                results_list = [results] if results is not None else [None] * len(batch_keys)
            else:
                results_list = results

            for key, result, tokens, original in zip(
                batch_keys, results_list, token_maps, originals
            ):
                raw = getattr(result, "text", None) if result is not None else None
                if raw:
                    translated[key] = restore_placeholders(str(raw), tokens)
                else:
                    translated[key] = original
                key_bar.update(1)
                since_save += 1

            persist_if_needed()
            await asyncio.sleep(DELAY_SEC)

    if not dry_run and since_save > 0:
        try:
            save_checkpoint(mobile, code, translated)
            write_locale_file(out_path, code, translated)
        except (PermissionError, OSError) as err:
            tqdm.write(f"  [warn] sauvegarde finale {code} ignoree: {err}")


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
    atomic_write_text(out_path, serialize_locale(code, translated))


def main() -> int:
    parser = argparse.ArgumentParser(description="Génère les locales Fotoce via googletrans")
    parser.add_argument("--lang", help="Une seule langue (ex. es)")
    parser.add_argument("--mobile", action="store_true", help="Cible Fotoce-Mobile")
    parser.add_argument("--force", action="store_true", help="Écrase et régénère (ignore checkpoints)")
    parser.add_argument("--dry-run", action="store_true", help="Ne pas écrire les fichiers")
    parser.add_argument(
        "--workers",
        type=int,
        default=DEFAULT_WORKERS,
        help=f"Threads paralleles (defaut: {DEFAULT_WORKERS})",
    )
    args = parser.parse_args()

    workers = max(1, min(args.workers, 32))

    locales_dir = (
        ROOT.parent / "Fotoce-Mobile" / "src" / "i18n" / "locales"
        if args.mobile
        else ROOT / "src" / "i18n" / "locales"
    )

    registry = parse_registry(REGISTRY_PATH.read_text(encoding="utf-8"))
    source = load_en_dict(locales_dir)
    keys = list(source.keys())
    total_keys = len(keys)

    try:
        gt_version = version("googletrans")
    except Exception:
        gt_version = "?"
    tqdm.write(f"Source: {total_keys} cles dans {locales_dir / 'en.ts'}")
    tqdm.write(f"googletrans {gt_version} (async) | workers: {workers}")

    targets = [l for l in registry if l["code"] != "en" and l["google_code"]]
    if args.lang:
        targets = [l for l in targets if l["code"] == args.lang]
    elif not args.force:
        targets = [l for l in targets if l["code"] != "fr"]

    if args.lang and not targets:
        tqdm.write(f"Langue inconnue ou sans googleCode: {args.lang}", file=sys.stderr)
        return 1

    tqdm.write(f"Cibles: {len(targets)} langue(s) | checkpoint: {checkpoint_dir(args.mobile)}")

    lang_bar = tqdm(
        targets,
        desc="Langues",
        unit="lang",
        file=sys.stdout,
        dynamic_ncols=True,
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}] {postfix}",
    )

    for lang in lang_bar:
        code = lang["code"]
        assert lang["google_code"]
        dest = googletrans_dest(lang["google_code"])
        out_path = locales_dir / f"{code}.ts"

        if args.force:
            clear_checkpoint(args.mobile, code)

        translated = load_progress(args.mobile, code, source, locales_dir, force=args.force)
        pending_keys = [k for k in keys if k not in translated]
        already_done = len(translated)

        lang_bar.set_postfix_str(f"{code} ({already_done}/{total_keys})")

        if not pending_keys:
            tqdm.write(f"[skip] {code}.ts complet ({already_done}/{total_keys} cles)")
            continue

        if already_done:
            tqdm.write(f"[resume] {code} — {already_done}/{total_keys} deja traduites -> {dest}")
        else:
            tqdm.write(f"[lang] {code} -> googletrans {dest}")

        key_bar = tqdm(
            total=total_keys,
            initial=already_done,
            desc=f"  {code}",
            unit="cle",
            file=sys.stdout,
            dynamic_ncols=True,
            leave=True,
            bar_format="{desc}: {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}]",
        )

        asyncio.run(
            translate_keys_async(
                pending_keys,
                source,
                dest,
                translated,
                key_bar,
                mobile=args.mobile,
                code=code,
                out_path=out_path,
                dry_run=args.dry_run,
                workers=workers,
            )
        )

        key_bar.close()

        if args.dry_run:
            tqdm.write(f"  (dry-run) {out_path}")
        else:
            write_locale_file(out_path, code, translated)
            clear_checkpoint(args.mobile, code)
            tqdm.write(f"  [ok] {out_path} ({len(translated)} cles)")

    lang_bar.close()
    tqdm.write("Termine.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
