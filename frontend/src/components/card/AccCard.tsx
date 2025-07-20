// src/components/AccelerometerCard.tsx (Updated)
import React, { useRef, useEffect, useState, useCallback } from 'react';
import CardWrapper from './CardWrapper'; // Importar o CardWrapper

interface AccelerometerData {
  x: number;
  y: number;
  z: number; // Z será usado para a animação de distância
}

interface AccelerometerContentProps { // Conteúdo real da animação
  data: AccelerometerData; // Agora sabemos que data não será nula aqui
  cardWidth: number;
  cardHeight: number;
}

// Interface para um ponto individual na nova animação
interface AnimatedPoint {
  id: string;
  x: number;
  startY: number;      // Posição Y inicial (topo ou base do card)
  targetY: number;     // Posição Y final que o ponto deve alcançar
  currentY: number;    // Posição Y atual do ponto
  startTime: number;   // Tempo em que o ponto foi criado
  duration: number;    // Duração total da viagem (em ms)
  opacity: number;
  direction: number;   // 1 para baixo (Z positivo), -1 para cima (Z negativo)
}

const AccelerometerCardContent: React.FC<AccelerometerContentProps> = ({
  data,
  cardWidth,
  cardHeight,
}) => {
  const centerX = cardWidth / 2;
  const svgHeight = cardHeight - 100; // Espaço para a SVG, considerando título e valores de texto
  const centerY_svg = svgHeight / 2; // Centro Y da área da SVG para o vetor X,Y
  
  const maxVectorLength = Math.min(centerX, centerY_svg) * 0.8; // Comprimento máximo do vetor (80% do raio menor)

  // Estados e Refs para a animação dos pontos Z
  const [animatedPoints, setAnimatedPoints] = useState<AnimatedPoint[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const pointIdCounter = useRef<number>(0);
  const lastProcessedZTimestamp = useRef<number>(0); 
  const lastGeneratedZValue = useRef<number | null>(null);

  // Configurações da animação de Z
  const POINTS_PER_UPDATE = 15;      // Número de pontos a gerar por cada atualização significativa
  const MIN_Z_THRESHOLD = 0.5;       // Magnitude mínima de Z para disparar uma animação
  const BASE_SPEED_PX_PER_MS = 0.005; // Velocidade base dos pontos (pixels por milissegundo)
  const MAX_TRAVEL_DISTANCE = svgHeight / 2 * 0.9; // Distância máxima que um ponto pode viajar (quase metade do card)
  const Z_ACCELERATION_SCALE = 20;   // Aceleração Z máxima esperada para atingir MAX_TRAVEL_DISTANCE
  const Z_UPDATE_INTERVAL_MS = 100;
  const Z_CHANGE_THRESHOLD = 0.1;

  // Callback para a função de animação
  const animatePoints = useCallback((time: DOMHighResTimeStamp) => {
    setAnimatedPoints(prevPoints => {
      return prevPoints.filter(point => {
        const elapsedTime = time - point.startTime;
        let progress = elapsedTime / point.duration;

        if (progress >= 1) {
          return false; // Remover ponto se a animação terminou
        }

        // Interpolação linear para a posição Y
        point.currentY = point.startY + (point.targetY - point.startY) * progress;
        
        // Fade out simples para os pontos
        point.opacity = 1 - progress; // Diminui de 1 para 0 ao longo da duração
        
        return true; // Manter ponto se ainda estiver ativo
      });
    });

    // Continuar a animação
    animationFrameId.current = requestAnimationFrame(animatePoints);
  }, []);

  // useEffect para iniciar/parar a animação
  useEffect(() => {
    // Iniciar o loop de animação quando o componente montar
    animationFrameId.current = requestAnimationFrame(animatePoints);

    // Cleanup: parar a animação quando o componente desmontar
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [animatePoints]); // Executar apenas uma vez na montagem

  // useEffect para lidar com as atualizações de dados Z e gerar novos pontos
  useEffect(() => {
    const currentZ = data.z;
    const absZ = Math.abs(currentZ);
    const currentTime = performance.now();

    if(
      absZ < MIN_Z_THRESHOLD ||
      (currentTime - lastProcessedZTimestamp.current < Z_UPDATE_INTERVAL_MS &&
        lastGeneratedZValue.current !== null &&
        Math.abs(currentZ - lastGeneratedZValue.current) < Z_CHANGE_THRESHOLD
      )
    ){return;}

    lastProcessedZTimestamp.current = currentTime;
    lastGeneratedZValue.current= currentZ;

    const direction = currentZ > 0 ? 1 : -1; // 1 para baixo (Z positivo), -1 para cima (Z negativo)
    
    // Calcular a distância que o ponto deve viajar
    // A distância é proporcional à magnitude de Z, até um máximo definido
    const travelDistance = Math.min(absZ / Z_ACCELERATION_SCALE, 1) * MAX_TRAVEL_DISTANCE;
    
    // Calcular a duração da viagem com base na distância e na velocidade base
    // duration = distance / speed
    const duration = travelDistance / BASE_SPEED_PX_PER_MS;

    const newPoints: AnimatedPoint[] = [];
    for (let i = 0; i < POINTS_PER_UPDATE; i++) {
      const uniqueId = `${currentTime}-${pointIdCounter.current++}`;
    
      // Ajuste aqui: startY e targetY para iniciar no topo/base
      const startY = direction > 0 ? -5 : svgHeight + 5; // Começa um pouco fora da tela (topo ou base)
      const targetY = direction > 0 ? (0 + travelDistance) : (svgHeight - travelDistance); // Move-se para dentro do card
      
      newPoints.push({
          id: uniqueId,
          x: Math.random() * cardWidth, // Posição X aleatória
          startY: startY,
          targetY: targetY,
          currentY: startY, // Inicializa na posição de início
          startTime: currentTime, // Tempo atual
          duration: duration,
          opacity: 1, // Começa totalmente opaco
          direction: direction,
      });
    }
    setAnimatedPoints(prev => [...prev, ...newPoints]);
  }, [data, cardWidth, svgHeight, centerY_svg, MAX_TRAVEL_DISTANCE, MIN_Z_THRESHOLD, Z_ACCELERATION_SCALE, BASE_SPEED_PX_PER_MS]);

  // --- Visualização X, Y (mantido do código anterior) ---
  const currentX = data.x;
  const currentY = data.y;
  const currentZ = data.z;
  
  const magnitudeXY = Math.sqrt(currentX * currentX + currentY * currentY);

  const maxExpectedMagnitudeXY = 20; 
  const vectorLength = Math.min(magnitudeXY / maxExpectedMagnitudeXY, 1) * maxVectorLength;

  const angleRad = Math.atan2(currentY, currentX); 

  const endX = centerX + vectorLength * Math.cos(angleRad);
  const endY = centerY_svg + vectorLength * Math.sin(angleRad); // Usar centerY_svg

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="text-sm font-bold text-gray-800 mb-2">
        <p>X: {currentX.toFixed(2)} m/s²</p>
        <p>Y: {currentY.toFixed(2)} m/s²</p>
        <p className="text-purple-600">Z: {currentZ.toFixed(2)} m/s²</p> 
      </div>

      <svg width={cardWidth} height={svgHeight} viewBox={`0 0 ${cardWidth} ${svgHeight}`} className="border rounded-md bg-gray-50 relative overflow-hidden">
        {/* Linhas de referência (eixos) para X, Y */}
        <line x1={centerX} y1={0} x2={centerX} y2={svgHeight} stroke="#ccc" strokeWidth="1" /> 
        <line x1={0} y1={centerY_svg} x2={cardWidth} y2={centerY_svg} stroke="#ccc" strokeWidth="1" /> 
        
        {/* Ponto central */}
        <circle cx={centerX} cy={centerY_svg} r="3" fill="#3498db" />

        {/* Vetor de aceleração X, Y */}
        <line 
          x1={centerX} 
          y1={centerY_svg} 
          x2={endX} 
          y2={endY} 
          stroke="#e74c3c" 
          strokeWidth="3" 
          strokeLinecap="round"
        />
        {/* Ponta da seta */}
        <polygon 
          points={`${endX},${endY} ${endX - 5 * Math.cos(angleRad - Math.PI / 6)},${endY - 5 * Math.sin(angleRad - Math.PI / 6)} ${endX - 5 * Math.cos(angleRad + Math.PI / 6)},${endY - 5 * Math.sin(angleRad + Math.PI / 6)}`} 
          fill="#e74c3c" 
        />

        {/* Pontos animados do eixo Z */}
        {animatedPoints.map(point => (
          <circle 
            key={point.id} 
            cx={point.x} 
            cy={point.currentY} 
            r="2" 
            fill="blue" 
            opacity={point.opacity}
          />
        ))}
      </svg>
    </div>
  );
};

// Componente Wrapper para uso externo
interface AccelerometerCardProps {
    title: string;
    data: AccelerometerData | null;
    width?: number;
    height?: number;
}

const AccelerometerCard: React.FC<AccelerometerCardProps> = ({
    title,
    data,
    width,
    height,
}) => {
    return (
        <CardWrapper
            title={title}
            width={width}
            height={height}
            isLoading={!data}
            noDataMessage="Waiting for accelerometer data..."
        >
            {data ? (
                <AccelerometerCardContent
                    data={data}
                    cardWidth={width || 300}
                    cardHeight={height || 200}
                />
            ) : null}
        </CardWrapper>
    );
};

export default AccelerometerCard;