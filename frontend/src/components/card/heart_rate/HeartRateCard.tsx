// src/components/HeartRateCard.tsx
import React from "react";
import CardWrapper from '../CardWrapper'; // Importar o CardWrapper
import { cardConfigs } from '../../../config/cardConfig'; // Importar cardConfigs

// Interface para um ponto de dados de gráfico (reutilizado do ChartCardContent)
interface Point {
  x: number;
  value: number;
}

// Componente Wrapper para Heart Rate
interface HeartRateCardProps {
    title: string;
    data: Point[];
    width?: number;
    height?: number;
    unit?: string;
    color?: string; // Cor específica para o HR
    onClose?: () => void; // Adicionado para passar para o CardWrapper
}

const HeartRateCard: React.FC<HeartRateCardProps> = ({
    title,
    data,
    color = "#8884d8", // Cor padrão para HR
    width,
    height,
    unit = "bpm",
    onClose,
}) => {
    const currentValue = data[data.length - 1]?.value;
    const avgValue = data.length > 0 ?
      (data.reduce((sum, d) => sum + d.value, 0) / data.length) : 0;

    const getDisplayPrecision = (value: number, currentUnit: string) => {
        if(currentUnit === "bpm" || currentUnit === "deg" || currentUnit === "km/h"){
          return value.toFixed(0);
        }
        return value.toFixed(2);
    }

    // Conteúdo para a nova área de detalhes
    const detailsContent = (
        <div className="flex justify-between w-full text-sm text-gray-700">
            <span className="font-semibold" style={{ color }}>
                Atual: {currentValue !== undefined ? `${getDisplayPrecision(currentValue, unit)} ${unit}` : "N/A"}
            </span>
            <span className="text-gray-500">
                Média: {getDisplayPrecision(avgValue, unit)} {unit}
            </span>
        </div>
    );

    // O HeartRateCard não tem botões de controlo específicos no cabeçalho (como o EEG),
    // então customHeaderContent pode ser undefined.

    return (
        <CardWrapper
            title={title}
            width={width}
            height={height}
            isLoading={!data || data.length === 0}
            noDataMessage="A aguardar dados..."
            detailsContent={detailsContent} // Passa o conteúdo dos detalhes
            onClose={onClose} // Passa a função de fechar
            // headerContent é undefined, então não é passado explicitamente
            
            // Passa o array de visualizações do cardConfig para 'hr'
            visualizations={cardConfigs['hr'].visualizations} 
            cardData={data} // Passa os dados brutos do gráfico
            // Passa props específicas para as visualizações (color, unit)
            visualizationProps={{ color, unit }}
        >
            {/* O CardWrapper agora renderiza o componente de visualização ativo. */}
            {/* Não há children direto aqui, pois as visualizações são gerenciadas pelo CardWrapper. */}
        </CardWrapper>
    );
};

export default HeartRateCard;
