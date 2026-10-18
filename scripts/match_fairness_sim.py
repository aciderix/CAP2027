#!/usr/bin/env python3
"""
Simulation d'équité du Match sur un export Demos Kratos (fichier `match`).

À relancer à chaque nouvel export pour recalibrer les paramètres du Match
(seuils d'éligibilité, amortissement K) avant de les reporter dans app_config :

    python3 scripts/match_fairness_sim.py demos-kratos-match-<ts>.json

Mesures :
  - équité   : électeurs qui répondent au hasard ; chaque candidat jouable
               devrait finir 1er aussi souvent que les autres (écart en points).
  - fidélité : électeur « clone » d'un candidat (même avis sur ses sujets,
               hasard ailleurs) ; % de fois où ce candidat finit bien 1er.
  - déblocage : nombre de cartes avant que chaque candidat jouable ait assez
               de comparaisons pour afficher un classement.

Règles simulées (docs/AUDIT_2026-10-18_RSS_DEMOS_KRATOS.md, section 4.6) :
  points +1 / −1 (±0,5 si « plutôt »), poids 1/√(affirmations du thème),
  score = Σ poids·points / (Σ poids + K), paquet de cartes adaptatif.
"""

from __future__ import annotations

import argparse
import collections
import json
import math
import random

POINTS = {"FOR": 1.0, "RATHER_FOR": 0.5, "RATHER_AGAINST": -0.5, "AGAINST": -1.0}


class Match:
    def __init__(self, path: str):
        data = json.load(open(path, encoding="utf-8"))
        self.name = {c["id"]: c["fullName"] for c in data["candidates"]}
        self.theme = {s["id"]: (s["theme"] or {}).get("slug", "aucun") for s in data["statements"]}
        self.statements = [s["id"] for s in data["statements"]]
        self.stance: dict[str, dict[str, str]] = collections.defaultdict(dict)
        for s in data["stances"]:
            self.stance[s["statementId"]][s["candidateId"]] = s["stance"]
        per_theme = collections.Counter(self.theme.values())
        self.weight = {sid: 1 / math.sqrt(per_theme[self.theme[sid]]) for sid in self.statements}
        self.cov_n = collections.Counter()
        self.cov_t: dict[str, set[str]] = collections.defaultdict(set)
        for sid, by_cand in self.stance.items():
            for c in by_cand:
                self.cov_n[c] += 1
                self.cov_t[c].add(self.theme[sid])
        self.n_themes = len(per_theme)

    def playable(self, min_statements: int, min_themes: int) -> list[str]:
        return [c for c in self.name
                if self.cov_n[c] >= min_statements and len(self.cov_t[c]) >= min_themes]

    def scores(self, answers: dict[str, int], cands: list[str], k: float) -> dict[str, float]:
        pts, wsum = collections.Counter(), collections.Counter()
        for sid, u in answers.items():
            w = self.weight[sid]
            for c, s in self.stance[sid].items():
                if c in cands:
                    pts[c] += w * u * POINTS[s]
                    wsum[c] += w
        return {c: pts[c] / (wsum[c] + k) for c in cands}

    def next_card(self, remaining, done_n, done_t, cands):
        # Carte la plus utile aux candidats les moins comparés, bonus si le
        # thème est nouveau pour eux ; léger aléa pour varier l'ordre.
        def gain(sid):
            g = sum(1 / (1 + done_n[c]) + (0.5 if self.theme[sid] not in done_t[c] else 0)
                    for c in self.stance[sid] if c in cands)
            return g + random.random() * 1e-3
        return max(remaining, key=gain)

    def play(self, cands, voter, n_cards=None, adaptive=True, unlock=None):
        remaining = [s for s in self.statements if any(c in self.stance[s] for c in cands)]
        random.shuffle(remaining)
        answers, done_n, done_t = {}, collections.Counter(), collections.defaultdict(set)
        for i in range(1, len(remaining) + 1):
            if n_cards is not None and i > n_cards:
                break
            sid = self.next_card(remaining, done_n, done_t, cands) if adaptive else remaining[0]
            remaining.remove(sid)
            u = voter(sid)
            if u is None:
                continue
            answers[sid] = u
            for c in self.stance[sid]:
                if c in cands:
                    done_n[c] += 1
                    done_t[c].add(self.theme[sid])
            if unlock and all(done_n[c] >= unlock[0] and len(done_t[c]) >= unlock[1] for c in cands):
                return answers, i
        return answers, None


def winners(scores):
    best = max(scores.values())
    return [c for c, v in scores.items() if v == best]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("match_json")
    ap.add_argument("--min-statements", type=int, default=13)
    ap.add_argument("--min-themes", type=int, default=10)
    ap.add_argument("--k", type=float, default=8)
    ap.add_argument("--unlock-comparisons", type=int, default=6)
    ap.add_argument("--unlock-themes", type=int, default=3)
    ap.add_argument("--runs", type=int, default=3000)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    random.seed(a.seed)
    m = Match(a.match_json)

    cands = m.playable(a.min_statements, a.min_themes)
    print(f"{len(m.statements)} affirmations, {m.n_themes} thèmes, {len(m.name)} candidats")
    print(f"Jouables (>= {a.min_statements} affirmations et >= {a.min_themes} thèmes) : {len(cands)}")
    for c in sorted(m.name, key=lambda c: -m.cov_n[c]):
        flag = "jouable" if c in cands else "PAS ASSEZ D'INFOS"
        print(f"  {m.name[c]:26} {m.cov_n[c]:>3} affirmations  {len(m.cov_t[c]):>2} thèmes  {flag}")
    if len(cands) < 2:
        print("Moins de 2 candidats jouables : rien à simuler.")
        return 0

    rnd = lambda sid: random.choice([1, -1]) if random.random() < 0.85 else None
    wins = collections.Counter()
    for _ in range(a.runs):
        answers, _ = m.play(cands, rnd)
        t = winners(m.scores(answers, cands, a.k))
        for c in t:
            wins[c] += 1 / len(t)
    ideal = 100 / len(cands)
    fair = max(abs(100 * wins[c] / a.runs - ideal) for c in cands)

    fid = 0.0
    per = max(50, a.runs // 20)
    for c0 in cands:
        def clone(sid, c0=c0):
            s = m.stance[sid].get(c0)
            if s:
                return 1 if POINTS[s] > 0 else -1
            return random.choice([1, -1]) if random.random() < 0.7 else None
        ok = 0.0
        for _ in range(per):
            answers, _ = m.play(cands, clone)
            t = winners(m.scores(answers, cands, a.k))
            ok += (c0 in t) / len(t)
        fid += ok / per
    fid = 100 * fid / len(cands)

    unlock = (a.unlock_comparisons, a.unlock_themes)
    needed = sorted(n for n in (m.play(cands, rnd, unlock=unlock)[1] for _ in range(a.runs)) if n)

    print(f"\nScore = Σ poids·points / (Σ poids + {a.k:g}), poids = 1/√(affirmations du thème)")
    print(f"  équité   : écart max {fair:.1f} pts autour de {ideal:.1f} %")
    print(f"  fidélité : {fid:.0f} % des clones ont bien leur candidat en 1er")
    if needed:
        print(f"  déblocage (>= {unlock[0]} comparaisons sur >= {unlock[1]} thèmes par candidat) : "
              f"médiane {needed[len(needed) // 2]} cartes, 90 % en {needed[int(len(needed) * 0.9)]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
