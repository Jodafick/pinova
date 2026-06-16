#!/usr/bin/env python3
from pathlib import Path

p = Path(__file__).resolve().parent.parent.parent / "fotoce-backend" / "scripts" / "seed_data.py"
t = p.read_text(encoding="utf-8")
for a, b in [
    ("Fotoce Plus", "Fotoce Plus"),
    ("'sponsor_name': 'Fotoce'", "'sponsor_name': 'Fotoce'"),
    ("sur Fotoce", "sur Fotoce"),
    ("pour Fotoce", "pour Fotoce"),
    ("Créateur Fotoce", "Créateur Fotoce"),
    ("tester Fotoce", "tester Fotoce"),
    ("Fotoce attend", "Fotoce attend"),
    ("Fotoce requires", "Fotoce requires"),
    ("'title': 'Fotoce Plus", "'title': 'Fotoce Plus"),
]:
    t = t.replace(a, b)
p.write_text(t, encoding="utf-8")
print("seed_data ok")
