#!/usr/bin/env python3
"""Balance pass: nudge card costs until no card's owner wins much more or less than half the time.
Each round plays Planner-vs-Planner matches (experiments.ts cards), then moves the cost of every card whose
owner win rate is outside 50 +/- BAND by one credit, and rebuilds cards.json.
Usage (from iso-beta):  python3 docs/v2/design-b/proto/tune-costs.py [rounds=3] [matches=8000]"""
import json, os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 3
n = sys.argv[2] if len(sys.argv) > 2 else '8000'
BAND = 3.5
adj_path = os.path.join(here, 'cost-adj.json')
adj = json.load(open(adj_path)) if os.path.exists(adj_path) else {}
for r in range(rounds):
    out = subprocess.run(['node', os.path.join(here, 'experiments.ts'), 'cards', '--n', n, '--json'], capture_output=True, text=True, check=True).stdout
    acc = json.loads(out.split('JSON:')[1])
    cards = json.load(open(os.path.join(here, '..', 'cards.json')))
    moved = []
    for c in cards:
        own = acc.get(c['id'] + '|own', 0)
        if own < 300: continue
        wr = 100 * acc.get(c['id'] + '|win', 0) / own
        step = 1 if wr > 50 + BAND else -1 if wr < 50 - BAND else 0
        if step and 2 <= c['cost'] + step <= 13:
            adj[c['id']] = adj.get(c['id'], 0) + step
            moved.append(f"{c['id']} {wr:.1f}% {c['cost']}->{c['cost'] + step}")
    adj = {k: v for k, v in adj.items() if v}
    json.dump(adj, open(adj_path, 'w'), indent=1, sort_keys=True)
    subprocess.run(['node', os.path.join(here, 'build-cards.ts')], check=True, capture_output=True)
    print(f'round {r + 1}: moved {len(moved)}: ' + ', '.join(moved))
    if not moved: break
