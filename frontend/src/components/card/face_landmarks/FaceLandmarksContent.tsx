// src/components/card/face_landmarks/FaceLandmarksCardContent.tsx
import React from 'react';
import { VisualizationContentProps } from '../CardWrapper';

// Interface para os dados de Face Landmarks
interface FaceLandmarksData {
  landmarks: number[][]; // Array de [x, y, z] pontos normalizados (0 a 1)
  gaze_vector: { dx: number; dy: number };
  ear: number; // Eye Aspect Ratio
  blink_rate: number;
  blink_counter: number;
  frame_b64: string; // Imagem em base64
  timestamp: number;
}

// Interface para as props do componente de conteúdo
interface FaceLandmarksContentProps extends VisualizationContentProps {
  data: FaceLandmarksData;
  // cardWidth e cardHeight já vêm de VisualizationContentProps
}

const FaceLandmarksCardContent: React.FC<FaceLandmarksContentProps> = ({
  data,
  cardWidth = 300, // Fornecer um valor padrão
  cardHeight = 100, // Fornecer um valor padrão
}) => {
  const {
    landmarks,
    // gaze_vector, // Não usado diretamente na visualização atual
    // ear, blink_rate, blink_counter, timestamp são para detailsContent
    // frame_b64, // Removido da visualização SVG para focar nos pontos
  } = data;

  // Definir margens para o SVG para dar espaço aos textos
  const svgMarginTop = 5;
  const svgMarginBottom = 5;
  const svgMarginLeft = 5;
  const svgMarginRight = 5;

  const svgWidth = cardWidth - svgMarginLeft - svgMarginRight;
  const svgHeight = cardHeight - svgMarginTop - svgMarginBottom;

  // Escalas para mapear os landmarks normalizados (0-1) para as dimensões do SVG
  const xScale = (val: number) => val * svgWidth;
  const yScale = (val: number) => val * svgHeight;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-2">
      <div className="relative flex-1 w-full flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
        {landmarks && landmarks.length > 0 ? (
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="border border-gray-300 rounded-md"
          >
            {/* Desenha cada landmark como um pequeno círculo */}
            {landmarks.map((point, index) => {
              // Ignoramos a coordenada Z para a visualização 2D
              const [x, y] = point;
              // A condição index < 163 é para desenhar um subconjunto de pontos, se desejado.
              // Se quiser todos, remova a condição.
              if (index < 163) {
                return (
                  <circle
                    key={index}
                    cx={xScale(x)}
                    cy={yScale(y)}
                    r={1.5} // Raio pequeno para os pontos
                    fill="#e74c3c" // Cor vermelha para os pontos
                    opacity={0.7}
                    // Adicionado transition para animar o movimento dos pontos
                    style={{ transition: 'cx 0.1s linear, cy 0.1s linear' }}
                  />
                );
              }
              return null; // Retorna null para pontos não renderizados
            })}
            {/* Opcional: Desenhar um círculo no centro da face (aproximado) */}
            {landmarks.length > 0 && (
              <circle
                cx={xScale(landmarks[90][0])} // Usando o landmark 90 como referência de centro
                cy={yScale(landmarks[90][1])}
                r={3}
                fill="#3498db" // Azul para o centro
                opacity={0.9}
                // Adicionado transition para animar o movimento do ponto central
                style={{ transition: 'cx 0.1s linear, cy 0.1s linear' }}
              />
            )}
          </svg>
        ) : (
          <p className="text-gray-500">A aguardar pontos de landmarks...</p>
        )}
      </div>
    </div>
  );
};

export default FaceLandmarksCardContent;
