# Need model report

Trained 2026-10-14. Trained on 2089 examples (0 real, rest synthetic seed). Thresholds tuned on 614 held-out examples.
Model size: 2541 features, 399 KB.

## held-out phrasings (synthetic) (614 messages)

| | model | keyword rules |
| --- | --- | --- |
| fact-need micro F1 | 82.3% | 74.2% |
| exact set of needs right | 68.4% | 61.1% |
| job type accuracy | 89.3% | not predicted |

| need | model F1 | rules F1 | in set |
| --- | --- | --- | --- |
| hours | 99.4% | 98.3% | 90 |
| location | 86.7% | 82.3% | 83 |
| payment | 82.8% | 71.1% | 78 |
| delivery | 74.3% | 60.2% | 69 |
| prices | 99.1% | 84.5% | 107 |
| booking | 87.7% | 50.4% | 86 |
| returns | 31.0% | 15.6% | 71 |
| contact | 47.8% | 87.9% | 53 |

## hand-written hard set (64 messages)

| | model | keyword rules |
| --- | --- | --- |
| fact-need micro F1 | 93.0% | 78.6% |
| exact set of needs right | 90.6% | 67.2% |
| job type accuracy | 96.9% | not predicted |

| need | model F1 | rules F1 | in set |
| --- | --- | --- | --- |
| hours | 100.0% | 88.9% | 8 |
| location | 90.0% | 70.6% | 9 |
| payment | 100.0% | 92.3% | 7 |
| delivery | 82.4% | 83.3% | 7 |
| prices | 100.0% | 63.6% | 11 |
| booking | 93.3% | 83.3% | 7 |
| returns | 85.7% | 80.0% | 6 |
| contact | 90.9% | 75.0% | 5 |

Honest reading: the hard set is small (64 messages I wrote by hand) and the training data is mostly synthetic. Treat these numbers as
a floor for how the model behaves on new phrasings, not as a promise about real customers. Retrain on real, consented messages before relying on it.
