// src/components/card/accelerometer/AccCard.tsx
import React from "react";
import CardWrapper from '../CardWrapper'; // Caminho ajustado
import { cardConfigs } from '../../../config/cardConfig'; // Caminho ajustado
import AccCardContent from './AccCardContent'; // Importar o componente de conteúdo

interface AccelerometerProcessedData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

// Componente Wrapper para Acelerômetro
interface AccCardProps {
    title: string;
    data: AccelerometerProcessedData | null;
    width?: number;
    height?: number;
    unit?: string;
    color?: string; // Cor específica para o Acelerômetro
    onClose?: () => void; // Adicionado para passar para o CardWrapper
}

const AccCard: React.FC<AccCardProps> = ({
    title,
    data,
    color = "#3498db", // Cor padrão para Acelerômetro
    width,
    height,
    unit = "m/s²",
    onClose,
}) => {
    // Conteúdo para a área de detalhes
    const detailsContent = (
        <div className="flex flex-col items-center justify-center w-full text-sm text-gray-700">
            <p>X: {data?.x !== undefined ? `${data.x.toFixed(2)} ${unit}` : "N/A"}</p>
            <p>Y: {data?.y !== undefined ? `${data.y.toFixed(2)} ${unit}` : "N/A"}</p>
            <p>Z: {data?.z !== undefined ? `${data.z.toFixed(2)} ${unit}` : "N/A"}</p>
        </div>
    );

    return (
        <CardWrapper
            title={title}
            width={width}
            height={height}
            isLoading={!data} // Apenas verifica se os dados são nulos
            noDataMessage="A aguardar dados do acelerômetro..."
            detailsContent={detailsContent} // Passa o conteúdo dos detalhes
            onClose={onClose} // Passa a função de fechar
            
            // Passa o array de visualizações do cardConfig para 'accelerometer'
            visualizations={cardConfigs['accelerometer'].visualizations} 
            cardData={data} // Passa os dados brutos do acelerômetro
            // Passa props específicas para as visualizações (color, unit)
            visualizationProps={{ color, unit }}
        >
            {/* O CardWrapper agora renderiza o componente de visualização ativo. */}
            {/* Não há children direto aqui, pois as visualizações são gerenciadas pelo CardWrapper. */}
        </CardWrapper>
    );
};

export default AccCard;
