import { useState, type CSSProperties, type ReactNode } from 'react';

export type LuxuryMenuOption = {
  id: string;
  lines: [string, string?];
  icon?: ReactNode;
  onClick?: () => void;
};

type LuxuryAnimatedMenuProps = {
  triggerLines: [string, string];
  enabled: boolean;
  options: LuxuryMenuOption[];
  /** Which way option circles fan out from the trigger. */
  expandDirection?: 'left' | 'right';
  /** Match other HUD circle buttons (px). */
  size?: number;
};

const GOLD = '#c5a85c';

function splitLabel(text: string): [string, string?] {
  const parts = text.trim().split(/\s+/);
  if (parts.length <= 1) return [parts[0] ?? 'VIEW'];
  const mid = Math.ceil(parts.length / 2);
  return [parts.slice(0, mid).join(' '), parts.slice(mid).join(' ')];
}

export function luxuryMenuOptionsFromLabels(
  items: { id: string; label: string; onClick: () => void }[],
  icons?: ReactNode[],
): LuxuryMenuOption[] {
  return items.map((item, i) => ({
    id: item.id,
    lines: splitLabel(item.label),
    icon: icons?.[i],
    onClick: item.onClick,
  }));
}

function circleStyle(size: number, fontSize: number, enabled = true): CSSProperties {
  return {
    width: size,
    height: size,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: `2px solid ${enabled ? GOLD : '#444'}`,
    backgroundColor: '#262420',
    color: '#ffffff',
    fontSize,
    fontWeight: 'bold',
    letterSpacing: '1.2px',
    lineHeight: '11px',
    textAlign: 'center',
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.35,
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.4)',
    flexShrink: 0,
    padding: 2,
    transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
  };
}

/**
 * Trigger stays fixed in the side column; options float out horizontally
 * without shifting sibling buttons (Brochure, Walk through, etc.).
 */
export function LuxuryAnimatedMenu({
  triggerLines,
  enabled,
  options,
  expandDirection = 'right',
  size = 56,
}: LuxuryAnimatedMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => {
    if (!enabled) return;
    setIsOpen((v) => !v);
  };

  const close = () => setIsOpen(false);

  const fontSize = size >= 56 ? 9 : 7;
  const optionSize = size >= 56 ? 48 : 44;
  const slideFrom = expandDirection === 'right' ? -14 : 14;

  const iconStyle: CSSProperties = {
    fontSize: 11,
    marginBottom: 2,
    color: GOLD,
    lineHeight: 1,
    fontWeight: 700,
  };

  const optionRow: CSSProperties = {
    position: 'absolute',
    top: '50%',
    ...(expandDirection === 'right'
      ? { left: '100%', marginLeft: 10, transform: 'translateY(-50%)' }
      : { right: '100%', marginRight: 10, transform: 'translateY(-50%)' }),
    display: 'flex',
    flexDirection: expandDirection === 'right' ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: '10px',
    pointerEvents: isOpen ? 'auto' : 'none',
  };

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        zIndex: isOpen ? 70 : 1,
        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!enabled}
        style={{
          ...circleStyle(size, fontSize, enabled),
          boxShadow: isOpen
            ? `0 0 18px ${GOLD}44, inset 0 0 10px rgba(0,0,0,0.5)`
            : circleStyle(size, fontSize, enabled).boxShadow,
        }}
      >
        {isOpen ? (
          <span style={{ fontSize: 16, color: GOLD, lineHeight: 1 }} aria-hidden>
            ✕
          </span>
        ) : (
          <>
            <div>{triggerLines[0]}</div>
            <div>{triggerLines[1]}</div>
          </>
        )}
      </button>

      <div style={optionRow} aria-hidden={!isOpen}>
        {options.map((opt, i) => (
          <button
            key={opt.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              opt.onClick?.();
              close();
            }}
            style={{
              ...circleStyle(optionSize, 7),
              color: '#e5e5e5',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              transitionDelay: `${i * 65}ms`,
              transform: isOpen ? 'translateX(0) scale(1)' : `translateX(${slideFrom}px) scale(0.8)`,
              opacity: isOpen ? 1 : 0,
              pointerEvents: isOpen ? 'auto' : 'none',
            }}
          >
            {opt.icon ? <span style={iconStyle}>{opt.icon}</span> : null}
            <div>{opt.lines[0]}</div>
            {opt.lines[1] ? <div>{opt.lines[1]}</div> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
