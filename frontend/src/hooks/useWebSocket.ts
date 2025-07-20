// src/hooks/useWebSocket.ts

import { useState, useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════════
                               TYPES E INTERFACES
═══════════════════════════════════════════════════════════════════════════════

*/

// Representa um ponto de dados individual (ECG, HR, EEG, etc.)
interface SignalPoint {
  timestamp: number;           // Quando foi capturado (Unix timestamp)
  value: any;                 // O valor actual (pode ser número, array, objeto)
  quality: number;            // Qualidade do sinal (0.0 a 1.0)
  metadata: Record<string, any>; // Informação extra (fonte, tipo, etc.)
}

// Mensagem de actualização de dados normais do backend
interface BackendSignalUpdate {
  type: 'signal.update';      // Identificador do tipo de mensagem
  signalType: 'cardiac' | 'eeg' | 'camera' | 'unity' | "sensors"; // Que sensor
  // ATUALIZADO: Adicionado 'faceLandmarks' e 'blinks' ao dataType
  dataType: 'ecg' | 'hr' | 'eegRaw' | 'eegBands' | 'faceLandmarks' | 'blinks' | 'steering' | 'speed' | "accelerometer" | "gyroscope"; // CORRIGIDO
  timestamp: number;          // Quando foi processado
  value: any;                // O valor dos dados
  anomalies?: string[];      // Lista de anomalias detectadas (opcional)
}

// Mensagem de alerta de anomalia específica
interface BackendAnomalyAlert {
  type: 'anomaly.alert';     // Tipo específico para anomalias
  signalType: string;        // Que sinal (cardiac, eeg, etc.)
  anomalyType: string;       // Tipo específico (bradycardia, electrode_loose, etc.)
  severity: string;          // Gravidade (info, warning, critical)
  message: string;           // Mensagem descritiva
  timestamp: number;         // Quando foi detectada
  value?: any;              // Valor que causou a anomalia (opcional)
  threshold?: any;          // Threshold que foi ultrapassado (opcional)
}

// Mensagem de heartbeat do sistema
interface BackendSystemHeartbeat {
  type: 'system.heartbeat';  // Heartbeat periódico
  timestamp: string;         // Timestamp do sistema
  systemHealth: any;         // Estado geral do sistema
  signalStatuses: any;       // Estado de todos os sinais
  activeConnections: number; // Quantos clientes WebSocket conectados
  uptime: number;           // Tempo que o sistema está a correr
}

// União de todos os tipos de mensagens possíveis do backend
type BackendMessage =
  | BackendSignalUpdate
  | BackendAnomalyAlert
  | BackendSystemHeartbeat
  | {
  type: 'zmq.connected' | 'zmq.error' | 'zmq.warning' | 'zmq.heartbeat' | 'connection.established';
  [key: string]: any; // Permite propriedades adicionais
};

// Estado da conexão WebSocket
interface ConnectionStatus {
  connected: boolean;        // Se está conectado
  reconnecting: boolean;     // Se está a tentar reconectar
  error: string | null;     // Mensagem de erro (se houver)
}

// ATUALIZADO: Inclui 'gyroscope' na LatestSensorData
interface LatestSensorData{
  accelerometer?:SignalPoint;
  gyroscope?: SignalPoint;
}

// ATUALIZADO: Inclui 'faceLandmarks' e 'blinks' na LatestCameraData
interface LatestCameraData {
  faceLandmarks?: SignalPoint; // CORRIGIDO: Propriedade para faceLandmarks
  blinks?: SignalPoint;
}

// O que o hook retorna para os componentes que o usam
interface UseWebSocketReturn {
  // Dados mais recentes de cada tipo de sinal
  latestCardiacData: { ecg?: SignalPoint; hr?: SignalPoint } | null;
  latestEegData: { raw?: SignalPoint; bands?: SignalPoint } | null;
  latestCameraData: LatestCameraData | null; // ATUALIZADO
  latestUnityData: { steering?: SignalPoint; speed?: SignalPoint } | null;
  latestSensorData: LatestSensorData | null;

  // Estado da conexão
  connectionStatus: ConnectionStatus;

  // Lista das últimas anomalias detectadas
  recentAnomalies: string[];

  // Funções para controlar a conexão manualmente
  connect: () => void;
  disconnect: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════════
                               HOOK PRINCIPAL
═══════════════════════════════════════════════════════════════════════════════
*/

export const useWebSocket = (
  url: string = 'ws://localhost:8000/api/ws'
): UseWebSocketReturn => {

  /* ─────────────────────────────────────────────────────────────────────────────
                                   ESTADO LOCAL
  ─────────────────────────────────────────────────────────────────────────────
  */

  const [latestCardiacData, setLatestCardiacData] = useState<{ ecg?: SignalPoint; hr?: SignalPoint } | null>(null);
  const [latestEegData, setLatestEegData] = useState<{ raw?: SignalPoint; bands?: SignalPoint } | null>(null);
  const [latestCameraData, setLatestCameraData] = useState<LatestCameraData | null>(null); // ATUALIZADO
  const [latestUnityData, setLatestUnityData] = useState<{ steering?: SignalPoint; speed?: SignalPoint } | null>(null);
  const [latestSensorData, setLatestSensorData] = useState<LatestSensorData | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
    error: null
  });

  const [recentAnomalies, setRecentAnomalies] = useState<string[]>([]);

  /* ─────────────────────────────────────────────────────────────────────────────
                                     REFS
  ─────────────────────────────────────────────────────────────────────────────
  */

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef<number>(0);

  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  /* ─────────────────────────────────────────────────────────────────────────────
                              FUNÇÕES DE CONEXÃO
  ─────────────────────────────────────────────────────────────────────────────────
  */

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      console.log(`Connecting to WebSocket: ${url}`);

      wsRef.current = new WebSocket(url);

      setConnectionStatus(prev => ({ ...prev, reconnecting: true, error: null }));

      /* ┌─────────────────────────────────────────────────────────────────────────
      │                           EVENT HANDLERS
      └─────────────────────────────────────────────────────────────────────────
      */

      wsRef.current.onopen = () => {
        console.log('WebSocket connected successfully');
        setConnectionStatus({
          connected: true,
          reconnecting: false,
          error: null
        });
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: BackendMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus(prev => ({
          ...prev,
          connected: false,
          error: event.reason || 'Connection closed'
        }));

        if (reconnectAttempts.current < maxReconnectAttempts) {
          scheduleReconnect();
        } else {
          setConnectionStatus(prev => ({
            ...prev,
            reconnecting: false,
            error: 'Max reconnection attempts reached'
          }));
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus(prev => ({
          ...prev,
          error: 'Connection error'
        }));
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionStatus(prev => ({
        ...prev,
        error: 'Failed to create connection'
      }));
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus({
      connected: false,
      reconnecting: false,
      error: null
    });
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttempts.current += 1;

    setConnectionStatus(prev => ({
      ...prev,
      reconnecting: true,
      error: `Reconnecting... (${reconnectAttempts.current}/${maxReconnectAttempts})`
    }));

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, reconnectDelay);
  };

  /* ─────────────────────────────────────────────────────────────────────────────
                           PROCESSAMENTO DE MENSAGENS
  ─────────────────────────────────────────────────────────────────────────────
  */

  const handleMessage = (message: BackendMessage) => {
    console.log('Received WebSocket message:', message); // Comentado para reduzir logs excessivos

    switch (message.type) {
      case 'signal.update':
        handleSignalUpdate(message);
        break;

      case 'anomaly.alert':
        handleAnomalyAlert(message);
        break;

      case 'system.heartbeat':
        // console.log('System heartbeat received:', message); // Comentado para reduzir logs excessivos
        break;

      case 'zmq.connected':
      case 'zmq.error':
      case 'zmq.warning':
      case 'zmq.heartbeat':
        console.log('ZeroMQ event:', message.type, message);
        break;

      case 'connection.established':
        console.log('Connection established:', message);
        break;

      default:
        console.log('Unknown message type:', message);
    }
  };

  const handleSignalUpdate = (message: BackendSignalUpdate) => {
    const { signalType, dataType, timestamp, value, anomalies } = message;

    const signalPoint: SignalPoint = {
      timestamp,
      value,
      quality: 1.0,
      metadata: { dataType, source: 'backend' }
    };

    switch (signalType) {
      case 'cardiac':
        setLatestCardiacData(prev => ({
          ...prev,
          [dataType]: signalPoint
        }));
        break;

      case 'eeg':
        setLatestEegData(prev => ({
          ...prev,
          [dataType === 'eegRaw' ? 'raw' : 'bands']: signalPoint
        }));
        break;

      case 'camera':
        // Lógica para lidar com diferentes tipos de dados de câmera
        setLatestCameraData(prev => {
          const newCameraData = { ...prev };
          // CORRIGIDO: Alterado 'landmarks' para 'faceLandmarks'
          if (dataType === 'faceLandmarks') {
            newCameraData.faceLandmarks = signalPoint;
          } else if (dataType === 'blinks') {
            newCameraData.blinks = signalPoint;
          }
          return newCameraData;
        });
        break;

      case 'unity':
        setLatestUnityData(prev => ({
          ...prev,
          [dataType]: signalPoint
        }));
        break;

      case "sensors":
        setLatestSensorData(prev => {
          const newSensorData = { ...prev };
          if (dataType === 'accelerometer') {
            newSensorData.accelerometer = signalPoint;
          } else if (dataType === 'gyroscope') {
            newSensorData.gyroscope = signalPoint;
          }
          return newSensorData;
        });
        break;
    }

    if (anomalies && anomalies.length > 0) {
      setRecentAnomalies(prev => [
        ...anomalies.map(a => `${signalType}: ${a}`),
        ...prev
      ].slice(0, 10));
    }
  };

  const handleAnomalyAlert = (message: BackendAnomalyAlert) => {
    if (message.severity === 'info') {
      return;
    }

    console.warn(`🚨 ANOMALY: ${message.signalType} - ${message.message}`, message);

    const timestamp = new Date(message.timestamp).toLocaleTimeString();

    const severityIcon = message.severity === 'critical' ? '🔴' :
                        message.severity === 'warning' ? '🟡' : '🔵';

    const anomalyMessage = `${severityIcon} [${timestamp}] ${message.signalType}: ${message.message}`;

    setRecentAnomalies(prev => [anomalyMessage, ...prev].slice(0, 10));
  };

  /* ─────────────────────────────────────────────────────────────────────────────
                                   EFFECTS
  ─────────────────────────────────────────────────────────────────────────────
  */

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [url]);

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  /* ─────────────────────────────────────────────────────────────────────────────
                                   RETORNO
  ─────────────────────────────────────────────────────────────────────────────
  */

  return {
    latestCardiacData,
    latestEegData,
    latestCameraData,
    latestUnityData,
    latestSensorData,

    connectionStatus,

    recentAnomalies,

    connect,
    disconnect
  };
};