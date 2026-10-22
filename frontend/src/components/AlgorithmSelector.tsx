/* ── AlgorithmSelector — pick the active load-balancing algorithm ── */

import type { AlgorithmType } from '../types';
import { ALGORITHM_LABELS, ALGORITHM_DESCRIPTIONS } from '../types';
import { setAlgorithm } from '../services/api';

interface Props {
  current: AlgorithmType;
  onChange: (algo: AlgorithmType) => void;
}

const ALGORITHMS: AlgorithmType[] = [
  'round_robin',
  'weighted_round_robin',
  'least_connections',
  'weighted_least_connections',
];

export function AlgorithmSelector({ current, onChange }: Props) {
  async function handleSelect(algo: AlgorithmType) {
    await setAlgorithm(algo);
    onChange(algo);
  }

  return (
    <div className="section">
      <div className="section__header">
        <h2 className="section__title">Load-Balancing Algorithm</h2>
        <span className="section__subtitle" aria-live="polite">
          Active: {ALGORITHM_LABELS[current]}
        </span>
      </div>
      <div className="algo-selector" role="radiogroup" aria-label="Select load-balancing algorithm">
        {ALGORITHMS.map((algo) => (
          <button
            key={algo}
            className={`algo-btn ${algo === current ? 'algo-btn--active' : ''}`}
            onClick={() => handleSelect(algo)}
            role="radio"
            aria-checked={algo === current}
            title={ALGORITHM_DESCRIPTIONS[algo]}
          >
            {ALGORITHM_LABELS[algo]}
          </button>
        ))}
      </div>
    </div>
  );
}
