#!/bin/sh
# Reproduces every number in results.md. Takes roughly 20-40 minutes on a 10-core laptop.
#   sh run_all.sh [matches=20000] [tournamentMatches=6000]
cd "$(dirname "$0")"
N=${1:-20000}; T=${2:-6000}
mkdir -p out logs
node experiments.ts mirror $N > logs/mirror.log 2>&1 &
node experiments.ts calls 4000 > logs/calls.log 2>&1 &
node experiments.ts cards $N > logs/cards.log 2>&1 &
for i in 0 1 2 3; do node experiments.ts skill $N $i/4 > logs/skill.$i.log 2>&1 & done
for i in 0 1 2 3; do node experiments.ts tournament $T $i/4 > logs/tournament.$i.log 2>&1 & done
node experiments.ts coaches $N 0/2 > logs/coaches.0.log 2>&1 &
node experiments.ts coaches $N 1/2 > logs/coaches.1.log 2>&1 &
wait
node report.ts > out/report.md
echo done > out/DONE
