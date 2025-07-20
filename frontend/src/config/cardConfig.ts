// src/config/cardConfig.ts

import React from 'react';
// Importe os componentes de card aqui para referência de tipo, embora não sejam usados diretamente neste arquivo
// import ChartCard from '../components/card/ChartCard';
// import AccelerometerCard from '../components/card/AccCard';
// import EegRawCard from '../components/card/EegRawCard';
// import GyroscopeCard from '../components/card/GyroCard';
// import FaceLandmarksCard from '../components/card/FaceLandmarksCard'; // NOVO: Import para referência de tipo

/**
 * @interface BaseCardConfig
 * @description Define a interface base para todas as configurações de card.
 */
export interface BaseCardConfig {
  signalType: string; // Identificador único para o tipo de sinal (ex: 'hr', 'ecg', 'accelerometer')
  label: string; // Rótulo de exibição para o tipo de sinal (ex: "Heart Rate", "ECG")
  // 'componentType' define qual componente React será usado para renderizar este card.
  // Isso permite que MainGrid.tsx decida dinamicamente qual componente importar e renderizar.
  componentType: 'chart' | 'accelerometer' | 'eegRaw' | 'gyroscope' | 'faceLandmarks'; // ATUALIZADO
  defaultColSpan: number; // Largura padrão em colunas da grade
  defaultRowSpan: number; // Altura padrão em linhas da grade
  unit?: string; // Unidade padrão para sinais baseados em gráfico (ex: 'bpm', 'mV')
  color?: string; // Cor padrão para sinais baseados em gráfico (ex: '#8884d8')
}

/**
 * @interface ChartCardConfig
 * @extends BaseCardConfig
 * @description Configuração específica para cards do tipo 'chart'.
 */
interface ChartCardConfig extends BaseCardConfig {
  componentType: 'chart';
  unit: string; // Unidade é obrigatória para ChartCard
  color: string; // Cor é obrigatória para ChartCard
}

/**
 * @interface AccelerometerCardConfig
 * @extends BaseCardConfig
 * @description Configuração específica para cards do tipo 'accelerometer'.
 */
interface AccelerometerCardConfig extends BaseCardConfig {
  componentType: 'accelerometer';
}

/**
 * @interface EegRawCardConfig
 * @extends BaseCardConfig
 * @description Configuração específica para cards do tipo 'eegRaw'.
 */
interface EegRawCardConfig extends BaseCardConfig {
  componentType: 'eegRaw';
  unit: string; // Unidade é obrigatória para EegRawCard
}

/**
 * @interface GyroscopeCardConfig
 * @extends BaseCardConfig
 * @description Configuração específica para cards do tipo 'gyroscope'.
 */
interface GyroscopeCardConfig extends BaseCardConfig {
  componentType: 'gyroscope';
}

/**
 * @interface FaceLandmarksCardConfig
 * @extends BaseCardConfig
 * @description Configuração específica para cards do tipo 'faceLandmarks'.
 */
interface FaceLandmarksCardConfig extends BaseCardConfig {
  componentType: 'faceLandmarks';
}

/**
 * @typedef {ChartCardConfig | AccelerometerCardConfig | EegRawCardConfig | GyroscopeCardConfig | FaceLandmarksCardConfig} CardConfig
 * @description Tipo de união para todas as possíveis configurações de card.
 */
export type CardConfig = ChartCardConfig | AccelerometerCardConfig | EegRawCardConfig | GyroscopeCardConfig | FaceLandmarksCardConfig; // ATUALIZADO

/**
 * @constant {Record<string, CardConfig>} cardConfigs
 * @description Um mapa que armazena as configurações para cada tipo de card, indexado por `signalType`.
 * Isso permite uma recuperação fácil e centralizada das propriedades do card.
 */
export const cardConfigs: Record<string, CardConfig> = {
  'hr': {
    signalType: 'hr',
    label: 'Frequência Cardíaca',
    componentType: 'chart',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'bpm',
    color: '#8884d8', // Roxo
  },
  'ecg': {
    signalType: 'ecg',
    label: 'ECG',
    componentType: 'chart',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'mV',
    color: '#82ca9d', // Verde
  },
  'eeg': { // Assumindo que 'eeg' é um gráfico genérico, se não for raw
    signalType: 'eeg',
    label: 'EEG (Processado)',
    componentType: 'chart',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'µV',
    color: '#ffc658', // Amarelo
  },
  'eegRaw': {
    signalType: 'eegRaw',
    label: 'EEG Bruto',
    componentType: 'eegRaw',
    defaultColSpan: 1, // EEG Raw pode se beneficiar de um tamanho padrão maior
    defaultRowSpan: 1,
    unit: 'µV',
  },
  'accelerometer': {
    signalType: 'accelerometer',
    label: 'Acelerômetro',
    componentType: 'accelerometer',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'm/s²', // Unidade padrão para aceleração
  },
  'gyroscope': {
    signalType: 'gyroscope',
    label: 'Giroscópio',
    componentType: 'gyroscope',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'deg/s', // Unidade padrão para velocidade angular
  },
  'faceLandmarks': { // NOVO: Configuração para FaceLandmarks
    signalType: 'faceLandmarks',
    label: 'Face Landmarks',
    componentType: 'faceLandmarks',
    defaultColSpan: 1,
    defaultRowSpan: 1, // Pode ser maior para a imagem
  },
  'steering': {
    signalType: 'steering',
    label: 'Ângulo de Direção',
    componentType: 'chart',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'deg',
    color: '#ff7300', // Laranja
  },
  'speed': {
    signalType: 'speed',
    label: 'Velocidade do Veículo',
    componentType: 'chart',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'km/h',
    color: '#00c49f', // Ciano
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