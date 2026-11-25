#!/bin/sh
# Reproduces every number in results.md. About 30 minutes on a 10-core laptop (Node 23.6+).
#   sh run_all.sh [matches=20000] [tournamentMatches=6000] [adversarialMatches=4000]
cd "$(dirname "$0")"
N=${1:-20000}; T=${2:-6000}; A=${3:-4000}
rm -rf out; mkdir -p out logs
# phase 1: requirement 1 and the per-card table
node experiments.ts mirror $N > logs/mirror.log 2>&1 &
node experiments.ts calls 4000 > logs/calls.log 2>&1 &
node experiments.ts cards $N > logs/cards.log 2>&1 &
for i in 0 1 2 3 4 5; do node experiments.ts skill $N $i/6 > logs/skill.$i.log 2>&1 & done
wait
# phase 2: requirement 2 round robins and the judge's adversarial tests
for i in 0 1 2 3 4 5; do node experiments.ts tournament $T $i/6 > logs/tournament.$i.log 2>&1 & done
node experiments.ts coaches $N 0/2 > logs/coaches.0.log 2>&1 &
node experiments.ts coaches $N 1/2 > logs/coaches.1.log 2>&1 &
node adv.ts draft $A > out/adv.draft.txt 2>&1 &
node adv.ts coach $A > out/adv.coach.txt 2>&1 &
wait
node adv.ts shape > out/adv.shape.txt 2>&1
node report.ts > out/report.md
echo done > out/DONE
