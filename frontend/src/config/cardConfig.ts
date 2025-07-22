// src/config/cardConfig.ts

import React from 'react';
import { VisualizationContentProps } from '../components/card/CardWrapper';

/**
 * @file cardConfig.ts
 * @description Centralized configuration for different types of data visualization cards.
 * This file defines the structure and properties for each card, including
 * signal type, display labels, default dimensions, units, colors, and
 * available visualization components.
 */

// Lazy load visualization components to optimize bundle size and initial load time.
const ChartCardContent = React.lazy(() => import('../components/card/ChartCardContent'));
const EegRawCardContent = React.lazy(() => import("../components/card/eeg/EegRawCardContent"));
const EegBrainMapContent = React.lazy(() => import("../components/card/eeg/EegBrainMapContent"));
const HeartRatePulsingCircleContent = React.lazy(() => import('../components/card/heart_rate/PulsingHeartRateContent'));
const AccCardContent = React.lazy(() => import('../components/card/acc/AccCardContent'));
const FaceLandmarksCardContent = React.lazy(() => import('../components/card/face_landmarks/FaceLandmarksContent'));
const GyroscopeCardContent = React.lazy(() => import('../components/card/gyro/GyroCardContent'));
const AlcoholLevelCardContent = React.lazy(() => import("../components/card/alcohol_level/AlcoholLevelCardContent"));
const CarInfoCardContent = React.lazy(() => import('../components/card/car_info/CarInfoCardContent'));


/**
 * @interface BaseCardConfig
 * @description Defines the base interface for all card configurations.
 */
export interface BaseCardConfig {
  signalType: string; // Unique identifier for the signal type (e.g., 'hr', 'ecg', 'accelerometer').
  label: string;      // Display label for the signal type (e.g., "Heart Rate", "ECG").
  defaultColSpan: number; // Default width in grid columns.
  defaultRowSpan: number; // Default height in grid rows.
  unit?: string;      // Optional default unit for graph-based signals (e.g., 'bpm', 'mV').
  color?: string;     // Optional default color for graph-based signals (e.g., '#8884d8').

  /**
   * Array of visualization configurations, allowing a card to have multiple ways to display data.
   */
  visualizations: Array<{
    label: string; // Label for the visualization toggle button.
    component: React.ComponentType<any>; // The React component for the visualization.
  }>;
}

/**
 * @typedef {BaseCardConfig} CardConfig
 * @description Type alias for `BaseCardConfig`, representing a complete card configuration.
 */
export type CardConfig = BaseCardConfig;

/**
 * @constant {Record<string, CardConfig>} cardConfigs
 * @description A map that stores configurations for each card type, indexed by `signalType`.
 * This allows for easy and centralized retrieval of card properties.
 */
export const cardConfigs: Record<string, CardConfig> = {
  'hr': {
    signalType: 'hr',
    label: 'Frequência Cardíaca',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'bpm',
    color: '#8884d8', // Purple
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
    color: '#82ca9d', // Green
    visualizations: [
      { label: 'Gráfico', component: ChartCardContent },
    ],
  },
  'eegRaw': {
    signalType: 'eegRaw',
    label: 'EEG Bruto',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'µV',
    visualizations: [
      { label: 'Gráfico de Canais', component: EegRawCardContent },
      { label: 'Mapa Cerebral', component: EegBrainMapContent },
    ],
  },
  'accelerometer': {
    signalType: 'accelerometer',
    label: 'Acelerômetro',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'm/s²', // Standard unit for acceleration
    color: '#3498db', // Default color for Accelerometer
    visualizations: [
      { label: 'Visualização 2D/3D', component: AccCardContent },
    ],
  },
  'gyroscope': {
    signalType: 'gyroscope',
    label: 'Giroscópio',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'deg/s', // Standard unit for angular velocity
    visualizations: [
      { label: 'Cubo 3D', component: GyroscopeCardContent },
    ],
  },
  'faceLandmarks': {
    signalType: 'faceLandmarks',
    label: 'Pontos Faciais',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    visualizations: [
      { label: 'Visualização Facial', component: FaceLandmarksCardContent },
    ],
  },
  'alcohol_level': {
    signalType: 'alcohol_level',
    label: 'Nível de Álcool',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'd/L', // Promille (per mille)
    color: '#2ecc71', // Default color (green)
    visualizations: [
      { label: 'Indicador', component: AlcoholLevelCardContent },
    ],
  },
  'car_information': {
    signalType: 'car_information',
    label: 'Info Carro',
    defaultColSpan: 1,
    defaultRowSpan: 1,
    unit: 'km/h', // Default unit for speed, though the card has multiple
    color: '#e67e22', // Default color (orange)
    visualizations: [
      { label: 'Detalhes do Carro', component: CarInfoCardContent },
    ],
  },
  // Add more card configurations here as needed for new signals.
};

/**
 * @function getCardConfigBySignalName
 * @param {string} signalName - The signal name received from the backend (e.g., 'hr_data', 'ecg_signal').
 * @returns {CardConfig | undefined} The corresponding card configuration or undefined if not found.
 * @description This function maps a `signalName` (which may include suffixes) to its `signalType`
 * and returns the associated card configuration. The order of checks is important:
 * more specific checks should come first.
 */
export const getCardConfigBySignalName = (signalName: string): CardConfig | undefined => {
  if (signalName.includes('eegRaw')) return cardConfigs['eegRaw'];
  if (signalName.includes('faceLandmarks')) return cardConfigs['faceLandmarks'];
  if (signalName.includes('hr')) return cardConfigs['hr'];
  if (signalName.includes('ecg')) return cardConfigs['ecg'];
  if (signalName.includes('eeg')) return cardConfigs['eeg'];
  if (signalName.includes('accelerometer')) return cardConfigs['accelerometer'];
  if (signalName.includes('gyroscope')) return cardConfigs['gyroscope'];
  if (signalName.includes('alcohol_level')) return cardConfigs['alcohol_level'];
  if (signalName.includes('car_information')) return cardConfigs['car_information'];
  if (signalName.includes('steering')) return cardConfigs['steering'];
  if (signalName.includes('speed')) return cardConfigs['speed'];
  return undefined; // Returns undefined if no matching signal type is found.
};