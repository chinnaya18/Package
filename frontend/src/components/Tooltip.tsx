/* ── Tooltip component ── */

import { Info } from 'lucide-react';

interface Props {
  text: string;
}

export function Tooltip({ text }: Props) {
  return (
    <span className="info-tooltip" tabIndex={0} role="tooltip" aria-label={text}>
      <Info className="info-tooltip__icon" />
      <span className="info-tooltip__text">{text}</span>
    </span>
  );
}
