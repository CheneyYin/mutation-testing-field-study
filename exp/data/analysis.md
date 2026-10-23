
## H2 incremental ladder (comment-only patches)

# P1 cost table (showdown)

| cell | conc | scope | wall s | cpu s | mutants | killed | survived | static | dry s | truncated |
|---|---|---|---|---|---|---|---|---|---|---|
| s_c2_r1 | 2 | small | 1183.4 | 2037.1 | 401 | 253 | 112 | 48 | 51 | false |
| s_c1_r1 | 1 | small | 1795.8 | 1897.8 | 401 | 251 | 113 | 48 | 66 | false |
| s_c4_r1 | 4 | small | 85.1 | 9 | 0 | 0 | 0 | 0 | ? | false |
| s_c2_r2 | 2 | small | 1314.6 | 2019.8 | 401 | 252 | 112 | 48 | 99 | false |
| s_c1_r2 | 1 | small | 3526 | 3.7 | 0 | 0 | 0 | 0 | 57 | true |
| s_c4_r2 | 4 | small | 766.7 | 1982.7 | 401 | 252 | 113 | 48 | 59 | false |
| s_c4_r1b | 4 | small | 498.7 | 1894.7 | 401 | 253 | 113 | 48 | 51 | false |
| m_c2_r1 | 2 | medium | 1548.8 | 3716.8 | 256 | 144 | 74 | 181 | 51 | false |
| m_c4_r1 | 4 | medium | 933.6 | 3911.2 | 256 | 143 | 72 | 181 | 50 | false |
| m_c2_r2 | 2 | medium | 1592.4 | 3776.7 | 256 | 144 | 74 | 181 | 50 | false |
| m_c4_r2 | 4 | medium | 868.6 | 3833.4 | 256 | 143 | 74 | 181 | 50 | false |
| h3_false | 2 | small | 1000.8 | 2241.7 | 401 | 254 | 116 | 48 | 51 | false |
| hl_high | 2 | small | 897.1 | 1958.5 | 401 | 252 | 113 | 48 | 52 | false |

## H3 (ignoreStatic pair, small scope, conc2)

wall(true)=1183.4s wall(false)=1000.8s -> savings=-183s
H3 corrected model prediction: staticCount(48) x suiteTime(51s) / conc(2) = 1224s

## hitLimit pair (small, conc2)

default: 1183.4s (timeouts 6) vs high: 897.1s (timeouts 6)
- k=1: base 1921s cpu -> rerun 74s cpu (96% saved), reused 395/401
- k=10: base 1921s cpu -> rerun 102s cpu (95% saved), reused 383/401
- k=100: base 1941s cpu -> rerun 168s cpu (91% saved), reused 353/401

## Killed-set invariance across concurrency (Killed+Timeout ids)

- s_c1_r1_vs_s_c2_r1: 258 vs 259 killed, 27 flips

## P4 quality (A vs B, writer-aggregate, headroom defects)

n=5, A-only detections=0, B-only=1, exact McNemar p=1.0000
- arm A: 0/5 detected (0%)
- arm B: 1/5 detected (20%)
- arm C: 0/5 detected (0%)

## Post-arm mutation scores (4-file frame, ignoreStatic=true, conc2 amendment, pinned)

| suite | mutants | killed | survived | covered-kill % |
|---|---|---|---|---|
| base | 810 | 483 | 245 | 66.3 |
| a1 | 810 | 506 | 227 | 69.0 |
| a2 | 810 | 511 | 228 | 69.1 |
| a3 | 810 | 508 | 228 | 69.0 |
| b1 | 810 | 483 | 245 | 66.3 |
| b2 | 810 | 483 | 245 | 66.3 |
| b3 | 810 | 499 | 271 | 64.8 |

Arm mean covered-kill rate: A=69.1% (n=3), B=65.8% (n=3)

## Environment

cores=8 cpu=Cortex-A32 node=v24.19.0 stryker=10.0.0
