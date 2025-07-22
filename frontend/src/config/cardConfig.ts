// src/config/cardConfig.ts

import React from 'react';
// Importar a interface para as props de conteúdo do CardWrapper
import { VisualizationContentProps } from '../components/card/CardWrapper'; 

// Importar os componentes de conteúdo para as visualizações
// Certifique-se que o caminho está correto para a sua estrutura de pastas
const ChartCardContent = React.lazy(() => import('../components/card/ChartCardContent')); 
const EegRawCardContent = React.lazy(() => import("../components/card/eeg/EegRawCardContent")); 
const EegBrainMapContent = React.lazy(() => import("../components/card/eeg/EegBrainMapContent")); 
const HeartRatePulsingCircleContent = React.lazy(() => import('../components/card/heart_rate/PulsingHeartRateContent'));
// NOVO: Importar o componente de conteúdo do Acelerômetro
const AccCardContent = React.lazy(() => import('../components/card/acc/AccCardContent'));
const GyroCardContent = React.lazy(() => import('../components/card/gyro/GyroCardContent'));
// NOVO: Importar o componente de conteúdo do FaceLandmarks
const FaceLandmarksCardContent = React.lazy(() => import('../components/card/face_landmarks/FaceLandmarksContent'));


/**
 * @interface BaseCardConfig
 * @description Define a interface base para todas as configurações de card.
 */
export interface BaseCardConfig {
  signalType: string; // Identificador único para o tipo de sinal (ex: 'hr', 'ecg', 'accelerometer')
  label: string; // Rótulo de exibição para o tipo de sinal (ex: "Heart Rate", "ECG")
  defaultColSpan: number; // Largura padrão em colunas da grade
  defaultRowSpan: number; // Altura padrão em linhas da grade
  unit?: string; // Unidade padrão para sinais baseados em gráfico (ex: 'bpm', 'mV')
  color?: string; // Cor padrão para sinais baseados em gráfico (ex: '#8884d8')
  
  // NOVO: Array de configurações de visualização
  visualizations: Array<{
    label: string; // Rótulo para o botão de alternar visualização
    component: React.ComponentType<any>; // O componente React da visualização
    // Pode adicionar outras props específicas da visualização aqui, se necessário
  }>;
}

/**
 * @typedef {BaseCardConfig} CardConfig
 * @description Tipo de união para todas as possíveis configurações de card.
 */
export type CardConfig = BaseCardConfig; // Simplificado, pois 'visualizations' agora é a chave

/**
 * @constant {Record<string, CardConfig>} cardConfigs
 * @description Um mapa que armazena as configurações para cada tipo de card, indexado por `signalType`.
 * Isso permite uma recuperação fácil e centralizada das propriedades do card.
 */
export const cardConfigs: Record<string, CardConfig> = {
  'hr': {
    signalType: 'hr',
    label: 'Frequência Cardíaca',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'bpm',
    color: '#8884d8', // Roxo
    visualizations: [
      { label: 'Gráfico', component: ChartCardContent }, 
      { label: 'Círculo Pulsante', component: HeartRatePulsingCircleContent }, 
    ],
  },
  'ecg': {
    signalType: 'ecg',
    label: 'ECG',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'mV',
    color: '#82ca9d', // Verde
    visualizations: [
      { label: 'Gráfico', component: ChartCardContent }, 
    ],
  },
  'eegRaw': {
    signalType: 'eegRaw',
    label: 'EEG Bruto',
    defaultColSpan: 1, // EEG Raw pode se beneficiar de um tamanho padrão maior
    defaultRowSpan: 1,
    unit: 'µV',
    // NOVO: Definindo múltiplas visualizações para eegRaw
    visualizations: [
      { label: 'Gráfico de Canais', component: EegRawCardContent }, // Gráfico de linhas
      { label: 'Mapa Cerebral', component: EegBrainMapContent },   // Mapa cerebral
      // Poderíamos adicionar mais visualizações aqui, como um espectrograma, etc.
    ],
  },
  'accelerometer': {
    signalType: 'accelerometer',
    label: 'Acelerômetro',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'm/s²', // Unidade padrão para aceleração
    color: '#3498db', // Cor padrão para Acelerômetro
    visualizations: [
      { label: 'Visualização 2D', component: AccCardContent }, // NOVO: Adicionado AccCardContent
    ],
  },
  'gyroscope': {
    signalType: 'gyroscope',
    label: 'Giroscópio',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'deg/s', // Unidade padrão para velocidade angular
    visualizations: [
      {label: "Giroscópio: Visualização 3D", component: GyroCardContent},
      // { label: 'Cubo 3D', component: GyroCardContent }, // Assumindo que GyroCardContent é a visualização 3D
    ],
  },
  'faceLandmarks': { // NOVO: Configuração para FaceLandmarks
    signalType: 'faceLandmarks',
    label: 'Pontos Faciais',
    defaultColSpan: 1, // Pode ser maior para a imagem
    defaultRowSpan: 1,
    visualizations: [
      { label: 'Visualização Facial', component: FaceLandmarksCardContent }, // Adicionado o componente de conteúdo
    ],
  },
  // Adicione mais configurações de card aqui conforme necessário para novos sinais
};

/**
 * @function getCardConfigBySignalName
 * @param {string} signalName - O nome do sinal recebido do backend (ex: 'hr_data', 'ecg_signal').
 * @returns {CardConfig | undefined} A configuração do card correspondente ou undefined se não for encontrada.
 * @description Esta função mapeia um `signalName` (que pode incluir sufixos) para o `signalType`
 * e retorna a configuração do card associada.
 */
export const getCardConfigBySignalName = (signalName: string): CardConfig | undefined => {
  // A ordem das verificações é IMPORTANTE: as verificações mais específicas devem vir primeiro.
  if (signalName.includes('eegRaw')) return cardConfigs['eegRaw'];
  if (signalName.includes('faceLandmarks')) return cardConfigs['faceLandmarks']; // NOVO: Adicionado e movido para cima
  if (signalName.includes('hr')) return cardConfigs['hr'];
  if (signalName.includes('ecg')) return cardConfigs['ecg'];
  if (signalName.includes('eeg')) return cardConfigs['eeg'];
  if (signalName.includes('accelerometer')) return cardConfigs['accelerometer'];
  if (signalName.includes('gyroscope')) return cardConfigs['gyroscope'];
  if (signalName.includes('steering')) return cardConfigs['steering'];
  if (signalName.includes('speed')) return cardConfigs['speed'];
  return undefined; // Retorna undefined se nenhum tipo de sinal correspondente for encontrado
};
