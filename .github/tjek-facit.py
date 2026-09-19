#!/usr/bin/env python3
"""Worker-ændring kræver et facit, der findes i grenen.

Kør i CI på pull_request. Ingen teater: scriptet læser PR-brødteksten og
diffen, og falder, hvis de to ikke hænger sammen.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys

FACIT_RE = re.compile(
    r"(?m)^[ \t]*Facit:[ \t]+(docs/facit/[A-Za-z0-9][A-Za-z0-9._-]*\.md)[ \t]*$"
)
INGEN_RE = re.compile(r"(?m)^[ \t]*Facit:[ \t]+ingen[ \t]+[—–-][ \t]+\S")


def strip_html_kommentarer(tekst: str) -> str:
    return re.sub(r"<!--.*?-->", "", tekst or "", flags=re.S)


def rorer_worker(filer: list[str]) -> bool:
    for f in filer:
        if f == "vh-worker" or f.startswith("vh-worker/"):
            return True
        if f.startswith("migrations/") or "/migrations/" in f:
            return True
    return False


def filer_i_diff(base: str, head: str) -> list[str]:
    out = subprocess.check_output(
        ["git", "diff", "--name-only", f"{base}...{head}"],
        text=True,
    )
    return [linje for linje in out.splitlines() if linje]


def vurder(broed: str, filer: list[str], findes) -> tuple[bool, str]:
    synlig = strip_html_kommentarer(broed)
    worker = rorer_worker(filer)
    m = FACIT_RE.search(synlig)
    ingen = INGEN_RE.search(synlig)

    if worker:
        if ingen and not m:
            return False, (
                "Worker-ændring må ikke bruge «Facit: ingen». "
                "Skriv Facit: docs/facit/<slug>.md og læg filen i grenen."
            )
        if not m:
            return False, (
                "Worker-ændring kræver en synlig linje: "
                "Facit: docs/facit/<slug>.md"
            )
        sti = m.group(1)
        if not findes(sti):
            return False, f"{sti} findes ikke i grenen."
        return True, f"Facit: {sti} (findes)"

    if m:
        sti = m.group(1)
        if not findes(sti):
            return False, f"{sti} findes ikke i grenen."
        return True, f"Facit: {sti} (findes)"
    if ingen:
        return True, "Facit: ingen (tilladt — rører ikke vh-worker)"
    return True, "Ingen Facit-linje — tilladt, fordi vh-worker ikke er rørt."


def proeve() -> int:
    fejl = 0

    def t(navn, broed, filer, eksisterende, skal_ok):
        nonlocal fejl
        ok, msg = vurder(broed, filer, lambda p: p in eksisterende)
        if ok is skal_ok:
            print("  ok   ", navn)
        else:
            fejl += 1
            print("  FEJL ", navn, "—", msg)

    t("worker uden facit", "hej\n", ["vh-worker/src/hegn.js"], set(), False)
    t(
        "worker med facit",
        "Facit: docs/facit/x.md\n",
        ["vh-worker/src/hegn.js"],
        {"docs/facit/x.md"},
        True,
    )
    t(
        "worker med ingen",
        "Facit: ingen — chore\n",
        ["vh-worker/src/hegn.js"],
        set(),
        False,
    )
    t(
        "migration raaber facit",
        "",
        ["vh-worker/migrations/0017_x.sql"],
        set(),
        False,
    )
    t(
        "docs med ingen",
        "Facit: ingen — kun docs\n",
        ["docs/x.md"],
        set(),
        True,
    )
    t("docs uden linje", "", ["README.md"], set(), True)
    t(
        "facit findes ikke",
        "Facit: docs/facit/mangler.md\n",
        ["vh-worker/a.js"],
        set(),
        False,
    )
    t(
        "kommentar tæller ikke",
        "<!-- Facit: docs/facit/x.md -->\n",
        ["vh-worker/src/hegn.js"],
        {"docs/facit/x.md"},
        False,
    )
    t(
        "docs med rigtig facit",
        "Facit: docs/facit/x.md\n",
        ["docs/x.md"],
        {"docs/facit/x.md"},
        True,
    )
    print("prøver fejlet:" if fejl else "prøver bestået:", fejl)
    return 1 if fejl else 0


def main(argv: list[str]) -> int:
    if "--proeve" in argv:
        return proeve()

    broed = os.environ.get("PR_BODY", "")
    base = os.environ.get("FACIT_BASE", "")
    head = os.environ.get("FACIT_HEAD", "HEAD")
    if not base:
        print("::error::FACIT_BASE mangler.", file=sys.stderr)
        return 2

    try:
        filer = filer_i_diff(base, head)
    except subprocess.CalledProcessError as e:
        print(f"::error::git diff fejlede: {e}", file=sys.stderr)
        return 2

    ok, msg = vurder(broed, filer, os.path.isfile)
    if ok:
        print(msg)
        if filer:
            print("rørte:", ", ".join(filer[:20]) + ("…" if len(filer) > 20 else ""))
        return 0
    print(f"::error::{msg}")
    print(msg, file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
