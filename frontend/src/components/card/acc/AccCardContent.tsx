// src/components/card/accelerometer/AccCardContent.tsx
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { VisualizationContentProps } from '../CardWrapper';

// Interface de dados para valores únicos (não arrays)
interface AccelerometerData {
  x: number;
  y: number; // Valor do eixo Y
  z: number;
  timestamp: number;
}

interface AccCardContentProps extends VisualizationContentProps {
  data: AccelerometerData | null; // Dados do acelerômetro (x, y, z como números)
  unit?: string;
  color?: string; // Cor para o vetor de aceleração
}


const AccCardContent: React.FC<AccCardContentProps> = ({
  data,
  unit = "m/s²",
  color = "#e74c3c", // Cor padrão para o vetor (vermelho)
  cardWidth = 300,
  cardHeight = 100,
}) => {
  // Calcular o centro da área de visualização
  const centerX = cardWidth / 2;
  const centerY = cardHeight / 2;

  // Obter os valores X, Y e Z do acelerômetro, com fallback para 0
  const currentX = data?.x || 0;
  const currentZ = data?.z || 0;
  const currentY = data?.y || 0; // Obter valor Y

  // Fator de escala para mapear os valores do acelerômetro para o tamanho do SVG
  const scaleFactor = useMemo(() => Math.min(cardWidth, cardHeight) / 40, [cardWidth, cardHeight]);

  // Calcular o ponto final do vetor de aceleração XZ
  const endX = centerX + currentX * scaleFactor;
  const endY_vector = centerY - currentZ * scaleFactor; // Subtrair para que Z positivo vá para cima no SVG

  // Calcular a magnitude do vetor XZ para a ponta da seta
  const magnitudeXZ = Math.sqrt(currentX * currentX + currentZ * currentZ);
  const angleRad = Math.atan2(currentZ, currentX); // Ângulo para a ponta da seta

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <svg width={cardWidth} height={cardHeight} viewBox={`0 0 ${cardWidth} ${cardHeight}`} className="border rounded-md bg-gray-50 relative overflow-hidden">
        {/* Linhas de referência: Eixo X (horizontal) e Eixo Z (vertical) */}
        <line x1={0} y1={centerY} x2={cardWidth} y2={centerY} stroke="#ccc" strokeWidth="1" /> {/* Eixo X */}
        <line x1={centerX} y1={0} x2={centerX} y2={cardHeight} stroke="#ccc" strokeWidth="1" /> {/* Eixo Z */}

        {/* Marcadores de texto para os eixos */}
        <text x={cardWidth - 15} y={centerY - 5} fontSize="10" fill="#666">X+</text>
        <text x={5} y={centerY - 5} fontSize="10" fill="#666">X-</text>
        <text x={centerX + 5} y={15} fontSize="10" fill="#666">Z+</text>
        <text x={centerX + 5} y={cardHeight - 5} fontSize="10" fill="#666">Z-</text>

        {/* Vetor de aceleração XZ */}
        <line
          x1={centerX}
          y1={centerY}
          x2={endX}
          y2={endY_vector}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Ponta da seta (triângulo) */}
        {magnitudeXZ > 0.1 && ( // Só mostra a ponta da seta se houver movimento significativo
          <polygon
            points={`${endX},${endY_vector} 
                     ${endX - 8 * Math.cos(angleRad - Math.PI / 6)},${endY_vector + 8 * Math.sin(angleRad - Math.PI / 6)} 
                     ${endX - 8 * Math.cos(angleRad + Math.PI / 6)},${endY_vector + 8 * Math.sin(angleRad + Math.PI / 6)}`}
            fill={color}
          />
        )}
      </svg>
    </div>
  );
};

export default AccCardContent;
