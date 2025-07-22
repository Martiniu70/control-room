// components/EegBrainMapContent.tsx
import React from 'react';

interface EegChannelPoint {
  x: number; // Tempo em segundos
  value: number; // Valor do sinal
}

interface EegBrainMapContentProps {
  data: { [key: string]: EegChannelPoint[] };
  cardWidth?: number;
  cardHeight?: number;
  selectedChannelKey?: string; // Canal selecionado para visualização
}

const EegBrainMapContent: React.FC<EegBrainMapContentProps> = ({
  data,
  cardWidth = 300,
  cardHeight = 100,
  selectedChannelKey, // Recebe o canal selecionado
}) => {
  // Definir as coordenadas aproximadas para os focos no mapa cerebral (normalizadas 0-100)
  // Estas coordenadas são relativas a um viewBox de 0 0 100 100 para o cérebro.
  // Ajustadas para a nova escala do cérebro (escala 0.7, translação 15)
  const brainFociPositions = {
    ch0: { x: 39.5, y: 29, label: "Córtex Pré-frontal Esquerdo" }, // Parte esquerda do córtex pré-frontal
    ch1: { x: 60.5, y: 29, label: "Córtex Pré-frontal Direito" },  // Parte direita do córtex pré-frontal
    ch2: { x: 32.5, y: 60.5, label: "Área Auditória/Linguística" }, // Seção auditória e linguística (esquerda)
    ch3: { x: 67.5, y: 60.5, label: "Área Auditória/Visual" },     // Seção auditória e de integração visual (direita)
  };

  // Encontrar o valor máximo absoluto em todos os canais para normalização do raio
  let maxOverallValue = 0;
  Object.values(data).forEach(channelData => {
    if (channelData.length > 0) {
      const channelMax = Math.max(...channelData.map(p => Math.abs(p.value)));
      if (channelMax > maxOverallValue) {
        maxOverallValue = channelMax;
      }
    }
  });

  // Função para mapear a intensidade do sinal para o raio do círculo
  const getRadius = (value: number) => {
    if (maxOverallValue === 0) return 0; // Evita divisão por zero
    // Raio mínimo para visibilidade, e escala até um raio máximo
    const minRadius = 3;
    const maxRadius = 25; // AUMENTADO: de 15 para 25
    const normalizedValue = Math.abs(value) / maxOverallValue;
    return minRadius + (maxRadius - minRadius) * normalizedValue;
  };

  // Função para mapear a intensidade do sinal para a opacidade da cor
  // Esta função agora será usada para a opacidade inicial do gradiente
  const getGradientPeakOpacity = (value: number) => {
    if (maxOverallValue === 0) return 0;
    const normalizedValue = Math.abs(value) / maxOverallValue;
    return 0.5 + 0.5 * normalizedValue; // Opacidade de 50% a 100% no pico do gradiente
  };

  // Cores base para os canais
  const channelColors = {
    ch0: "#e74c3c", // Vermelho
    ch1: "#27ae60", // Verde
    ch2: "#3498db", // Azul
    ch3: "#f39c12", // Laranja
  };

  // Caminho SVG aprimorado para o contorno do cérebro
  // Este caminho cria uma forma que afunila na frente e é mais larga/arredondada atrás.
  const brainOutlinePath = `
    M 50,5
    C 15,0 10,20 5,50
    C 0,80 20,100 50,95
    C 80,100 100,80 95,50
    C 90,20 85,0 50,5 Z
  `;
  // A fissura central permanece a mesma, adaptando-se à nova forma
  const centralFissurePath = `M 50,5 C 48,20 48,80 50,95`;

  // Fator de escala e translação para o cérebro
  const scaleFactor = 0.7; // Reduzir o cérebro para 70% do tamanho
  const translateX = (100 - 100 * scaleFactor) / 2; // Centralizar horizontalmente
  const translateY = (100 - 100 * scaleFactor) / 2; // Centralizar verticalmente


  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <svg
        width={cardWidth}
        height={cardHeight}
        viewBox="0 0 100 100" // ViewBox para o desenho do cérebro
        preserveAspectRatio="xMidYMid meet" // Mantém a proporção e centraliza
        className="bg-gray-50 rounded-md border border-gray-300"
      >
        {/* Definições de gradientes radiais para os focos de luz */}
        <defs>
          {Object.keys(channelColors).map(channelKey => {
            const color = channelColors[channelKey as keyof typeof channelColors];
            // Obter o último valor do canal para determinar a opacidade do pico
            const channelData = data[channelKey];
            const lastValue = channelData && channelData.length > 0
              ? channelData[channelData.length - 1].value
              : 0;
            const peakOpacity = getGradientPeakOpacity(lastValue);

            return (
              <radialGradient
                key={`gradient-${channelKey}`}
                id={`gradient-${channelKey}`}
                cx="50%" cy="50%" r="50%" fx="50%" fy="50%"
              >
                <stop offset="0%" stopColor={color} stopOpacity={peakOpacity} />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </radialGradient>
            );
          })}
        </defs>

        {/* Grupo para aplicar a transformação de escala e translação ao cérebro */}
        <g transform={`scale(${scaleFactor}) translate(${translateX / scaleFactor}, ${translateY / scaleFactor})`}>
          {/* Contorno do cérebro */}
          <path
            d={brainOutlinePath}
            fill="#dcdcdc" // Cor de fundo do cérebro
            stroke="#a0a0a0" // Contorno do cérebro
            strokeWidth="1"
          />

          {/* Fissura Central */}
          <path
            d={centralFissurePath}
            fill="none"
            stroke="#a0a0a0"
            strokeWidth="1.5"
          />
        </g>

        {/* Focos de intensidade para cada canal (fora do grupo para manter o tamanho) */}
        {Object.entries(brainFociPositions).map(([channelKey, pos]) => {
          // Lógica para mostrar apenas o canal selecionado, se houver
          if (selectedChannelKey && selectedChannelKey !== channelKey) {
            return null; // Não renderiza se um canal específico estiver selecionado e não for este
          }

          const channelData = data[channelKey];
          const lastValue = channelData && channelData.length > 0
            ? channelData[channelData.length - 1].value
            : 0; // Último valor do canal ou 0 se não houver dados

          const radius = getRadius(lastValue);
          // A opacidade é agora controlada pelo gradiente, não pelo círculo diretamente
          // const opacity = getOpacity(lastValue);

          return (
            <circle
              key={channelKey}
              cx={pos.x}
              cy={pos.y}
              r={radius}
              fill={`url(#gradient-${channelKey})`} // Aplicar o gradiente como preenchimento
              // opacity={opacity} // Removido, pois o gradiente já lida com a opacidade
              className="transition-all duration-300 ease-out" // Animação suave
            >
              {/* Tooltip básico ao passar o mouse */}
              <title>{`${pos.label}: ${lastValue.toFixed(2)} ${data.unit || 'µV'}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
};

export default EegBrainMapContent;
