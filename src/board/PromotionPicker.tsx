import { createElement } from 'react';
import type { PieceColor, PromotionRole } from '../chess/types.ts';
import './board.css';
// Piece images come from the cburnett theme, which is scoped to `.cg-wrap piece`.
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';

export interface PromotionPickerProps {
  color: PieceColor;
  onPick: (role: PromotionRole) => void;
  onCancel: () => void;
}

const ROLES: readonly PromotionRole[] = ['queen', 'rook', 'bishop', 'knight'];

/** Vietnamese names for screen readers; children choose by picture. */
const ROLE_LABEL: Readonly<Record<PromotionRole, string>> = {
  queen: 'Hậu',
  rook: 'Xe',
  bishop: 'Tượng',
  knight: 'Mã',
};

/** Big picture buttons to choose the promoted piece; no reading required. */
export function PromotionPicker({ color, onPick, onCancel }: PromotionPickerProps) {
  return (
    <div className="promotion-picker" role="dialog" aria-label="Chọn quân phong cấp">
      {ROLES.map((role) => (
        <button
          key={role}
          type="button"
          className="promotion-picker__choice"
          aria-label={ROLE_LABEL[role]}
          onClick={() => onPick(role)}
        >
          <span className="cg-wrap promotion-picker__piece">
            {createElement('piece', { className: `${role} ${color}` })}
          </span>
        </button>
      ))}
      <button
        type="button"
        className="promotion-picker__cancel"
        aria-label="Huỷ"
        onClick={onCancel}
      >
        <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
