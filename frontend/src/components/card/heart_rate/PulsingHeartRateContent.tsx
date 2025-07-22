import React, { useMemo, useEffect, useRef, useState } from 'react';
import { VisualizationContentProps } from '../CardWrapper';

interface Point {
  x: number;
  value: number;
}

interface HeartRatePulsingCircleContentProps extends VisualizationContentProps {
  data: Point[];
  color: string;
  cardWidth?: number;
  cardHeight?: number;
}

const HeartRatePulsingCircleContent: React.FC<HeartRatePulsingCircleContentProps> = ({
  data,
  color,
  cardWidth = 300,
  cardHeight = 100,
}) => {
  const latestHr = useMemo(() => (data.length > 0 ? data[data.length - 1].value : 0), [data]);

  const getAnimationDuration = (hr: number) => {
    if (hr === 0) return '2s';
    return `${Math.max(0.3, 60 / hr)}s`;
  };

  const getPulseScale = (hr: number) => {
    if (hr === 0) return 1.1;
    return 1.1 + (hr / 200) * 0.2;
  };

  const [activeHr, setActiveHr] = useState(latestHr);
  const [baseScale, setBaseScale] = useState(getPulseScale(latestHr));
  const [animationDuration, setAnimationDuration] = useState(getAnimationDuration(latestHr));
  const pendingHr = useRef<number | null>(null);
  const circleRef = useRef<SVGCircleElement>(null);

  // Atualiza HR pendente
  useEffect(() => {
    if (latestHr !== activeHr) {
      pendingHr.current = latestHr;
    }
  }, [latestHr, activeHr]);

  // Aplica HR pendente no fim do ciclo de animação
  useEffect(() => {
    const circle = circleRef.current;
    if (!circle) return;

    const handleAnimationIteration = () => {
      if (pendingHr.current !== null && pendingHr.current !== activeHr) {
        const newHr = pendingHr.current;
        setActiveHr(newHr);
        setBaseScale(getPulseScale(newHr));
        setAnimationDuration(getAnimationDuration(newHr));
        pendingHr.current = null;
      }
    };

    circle.addEventListener('animationiteration', handleAnimationIteration);
    return () => {
      circle.removeEventListener('animationiteration', handleAnimationIteration);
    };
  }, [activeHr]);

  const circleRadius = useMemo(() => Math.min(cardWidth, cardHeight) / 4, [cardWidth, cardHeight]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <style>
        {`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1); /* Escala da animação fixa */
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .heart-pulse-circle {
          animation: pulse ${animationDuration} infinite ease-in-out;
          transform-origin: center center;
          transition: transform 0.3s ease; /* Transição suave entre escalas base */
        }
        `}
      </style>
      <svg width={cardWidth} height={cardHeight} viewBox={`0 0 ${cardWidth} ${cardHeight}`}>
        <circle
          ref={circleRef}
          cx={cardWidth / 2}
          cy={cardHeight / 2}
          r={circleRadius}
          fill={color}
          className="heart-pulse-circle"
          style={{
            transform: `scale(${baseScale})`,
          }}
        />
        <text
          x={cardWidth / 2}
          y={cardHeight / 2 + 5}
          textAnchor="middle"
          alignmentBaseline="middle"
          fill="#FFFFFF"
          fontSize="20px"
          fontWeight="bold"
          pointerEvents="none"
        >
          {activeHr > 0 ? `${activeHr.toFixed(0)} bpm` : 'N/A'}
        </text>
      </svg>
    </div>
  );
};

export default HeartRatePulsingCircleContent;
