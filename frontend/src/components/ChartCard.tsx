// src/components/ChartCard.tsx
import React from "react";
import { scaleLinear } from "@visx/scale";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { curveMonotoneX } from "@visx/curve";

interface Point {
  x: number;
  value: number;
}

interface ChartCardProps {
  title: string;
  data: Point[];
  color: string;
  width?: number;
  height?: number;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  data,
  color,
  width = 300,
  height = 150,
}) => {
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };
  const xScale = scaleLinear({
    domain: [Math.max(0, data[0]?.x || 0), Math.max(1, data.at(-1)?.x || 10)],
    range: [margin.left, width - margin.right],
  });

  const yValues = data.map((d) => d.value);
  const yMin = Math.min(...yValues, 0);
  const yMax = Math.max(...yValues, 1);
  const yScale = scaleLinear({
    domain: [yMin, yMax],
    range: [height - margin.bottom, margin.top],
    nice: true,
  });

  return (
    <div className="w-full h-full p-2">
      <h2 className="text-sm font-medium text-center mb-1">{title}</h2>
      <svg width={width} height={height}>
        <Group>
          <AxisBottom
            scale={xScale}
            top={height - margin.bottom}
            tickFormat={(v) => `${v}s`}
          />
          <AxisLeft scale={yScale} left={margin.left} />
          <LinePath
            data={data}
            x={(d) => xScale(d.x)}
            y={(d) => yScale(d.value)}
            stroke={color}
            strokeWidth={2}
            curve={curveMonotoneX}
          />
        </Group>
      </svg>
    </div>
  );
};

export default ChartCard;
