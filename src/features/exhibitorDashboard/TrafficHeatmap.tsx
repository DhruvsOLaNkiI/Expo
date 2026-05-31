import { useMemo, type CSSProperties } from 'react';

type Props = {
  xLabels: string[];
  yLabels: string[];
  data: number[][];
  cellStyle?: (value: number, ratio: number, col: number, row: number) => CSSProperties;
};

export function TrafficHeatmap({ xLabels, yLabels, data, cellStyle }: Props) {
  const { min, max } = useMemo(() => {
    const flat = data.flat();
    return { min: Math.min(...flat), max: Math.max(...flat) };
  }, [data]);

  return (
    <div className="exb-heatmap" style={{ ['--exb-heatmap-cols' as string]: xLabels.length }}>
      <div className="exb-heatmap-corner" />
      {xLabels.map((label) => (
        <div key={label} className="exb-heatmap-x-label">
          {label}
        </div>
      ))}
      {yLabels.map((yLabel, row) => (
        <div key={yLabel} className="exb-heatmap-row">
          <div className="exb-heatmap-y-label">{yLabel}</div>
          {xLabels.map((_, col) => {
            const value = data[row]?.[col] ?? 0;
            const ratio = max === min ? 0 : (value - min) / (max - min);
            const style = cellStyle?.(value, ratio, col, row) ?? {
              background: `rgba(59, 130, 246, ${0.15 + ratio * 0.75})`,
            };
            return (
              <div key={`${row}-${col}`} className="exb-heatmap-cell" style={style} title={`${value}`}>
                {value}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
