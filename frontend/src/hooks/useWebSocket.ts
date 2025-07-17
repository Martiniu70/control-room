import { useState, useEffect, useRef } from 'react';

/* 
═══════════════════════════════════════════════════════════════════════════════
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
  signalType: 'cardiac' | 'eeg' | 'camera' | 'unity'; // Que sensor
  dataType: 'ecg' | 'hr' | 'eegRaw' | 'eegBands' | 'landmarks' | 'blinks' | 'steering' | 'speed'; // Que tipo de dados
  timestamp: number;          // Quando foi processado
  value: any;                // O valor dos dados
  anomalies?: string[];      // Lista de anomalias detectadas (opcional)
}

interface BackendSignalsResponse {
  type: "response.available_signals";
  availableSignals: string[];
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
  | BackendSignalsResponse
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

// O que o hook retorna para os componentes que o usam
interface UseWebSocketReturn {
  // Dados mais recentes de cada tipo de sinal
  latestCardiacData: { ecg?: SignalPoint; hr?: SignalPoint } | null;
  latestEegData: { raw?: SignalPoint; bands?: SignalPoint } | null;
  latestCameraData: { landmarks?: SignalPoint; blinks?: SignalPoint } | null;
  latestUnityData: { steering?: SignalPoint; speed?: SignalPoint } | null;
  
  // Estado da conexão
  connectionStatus: ConnectionStatus;
  
  // Lista das últimas anomalias detectadas
  recentAnomalies: string[];
  
  // Sinais disponiveis
  availableSignals: string[];

  // Funções para controlar a conexão manualmente
  connect: () => void;
  disconnect: () => void;
}

/* 
═══════════════════════════════════════════════════════════════════════════════
                               HOOK PRINCIPAL
═══════════════════════════════════════════════════════════════════════════════
*/

export const useWebSocket = (
  url: string = 'ws://localhost:8000/api/ws' // URL do WebSocket (NOTA: devia ser '/ws' não '/api/ws')
): UseWebSocketReturn => {

  /* 
  ─────────────────────────────────────────────────────────────────────────────
                                   ESTADO LOCAL
  ─────────────────────────────────────────────────────────────────────────────
  */
  
  // Estado para armazenar os dados mais recentes de cada tipo de sinal
  // Cada estado mantém apenas o valor mais recente de cada subtipo
  const [latestCardiacData, setLatestCardiacData] = useState<{ ecg?: SignalPoint; hr?: SignalPoint } | null>(null);
  const [latestEegData, setLatestEegData] = useState<{ raw?: SignalPoint; bands?: SignalPoint } | null>(null);
  const [latestCameraData, setLatestCameraData] = useState<{ landmarks?: SignalPoint; blinks?: SignalPoint } | null>(null);
  const [latestUnityData, setLatestUnityData] = useState<{ steering?: SignalPoint; speed?: SignalPoint } | null>(null);
  const [availableSignals, setAvailableSignals] = useState<string[]>([]);
  
  // Estado da conexão WebSocket
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
    error: null
  });
  
  // Lista das últimas 10 anomalias detectadas
  const [recentAnomalies, setRecentAnomalies] = useState<string[]>([]);
  
  /* 
  ─────────────────────────────────────────────────────────────────────────────
                                     REFS
  ─────────────────────────────────────────────────────────────────────────────
  */
  
  // useRef preserva valores entre re-renders sem causar re-renders
  // Referência para a instância WebSocket actual
  const wsRef = useRef<WebSocket | null>(null);
  
  // Timeout para reconnexão automática
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Contador de tentativas de reconnexão
  const reconnectAttempts = useRef<number>(0);
  
  // Configurações de reconnexão
  const maxReconnectAttempts = 5;  // Máximo 5 tentativas
  const reconnectDelay = 3000;     // 3 segundos entre tentativas

  /* 
  ─────────────────────────────────────────────────────────────────────────────
                              FUNÇÕES DE CONEXÃO
  ─────────────────────────────────────────────────────────────────────────────
  */

  const connect = () => {
    // Verificar se já está conectado para evitar múltiplas conexões
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      console.log(`Connecting to WebSocket: ${url}`);
      
      // Criar nova instância WebSocket
      wsRef.current = new WebSocket(url);
      
      // Indicar que está a tentar conectar
      setConnectionStatus(prev => ({ ...prev, reconnecting: true, error: null }));

      /* 
      ┌─────────────────────────────────────────────────────────────────────────
      │                           EVENT HANDLERS
      └─────────────────────────────────────────────────────────────────────────
      */

      // Quando a conexão é estabelecida com sucesso
      wsRef.current.onopen = () => {
        console.log('WebSocket connected successfully');
        setConnectionStatus({
          connected: true,
          reconnecting: false,
          error: null
        });
        // Reset do contador de tentativas após sucesso
        reconnectAttempts.current = 0;

        wsRef.current?.send(JSON.stringify({type: "request.available_signals"}));
      };

      // Quando recebe uma mensagem do backend
      wsRef.current.onmessage = (event) => {
        try {
          // Tentar fazer parse da mensagem JSON
          const message: BackendMessage = JSON.parse(event.data);
          handleMessage(message); // Processar a mensagem
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      // Quando a conexão é fechada
      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus(prev => ({ 
          ...prev, 
          connected: false,
          error: event.reason || 'Connection closed'
        }));
        
        // Lógica de reconnexão automática
        if (reconnectAttempts.current < maxReconnectAttempts) {
          scheduleReconnect(); // Agendar nova tentativa
        } else {
          // Desistir após máximo de tentativas
          setConnectionStatus(prev => ({ 
            ...prev, 
            reconnecting: false,
            error: 'Max reconnection attempts reached'
          }));
        }
      };

      // Quando há um erro de conexão
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

  // Desconectar manualmente
  const disconnect = () => {
    // Cancelar timeout de reconnexão se existir
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Fechar conexão WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Actualizar estado
    setConnectionStatus({
      connected: false,
      reconnecting: false,
      error: null
    });
  };

  // Agendar uma tentativa de reconnexão
  const scheduleReconnect = () => {
    // Cancelar timeout anterior se existir
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Incrementar contador de tentativas
    reconnectAttempts.current += 1;
    
    // Actualizar estado para mostrar que está a reconectar
    setConnectionStatus(prev => ({ 
      ...prev, 
      reconnecting: true,
      error: `Reconnecting... (${reconnectAttempts.current}/${maxReconnectAttempts})`
    }));
    
    // Agendar reconnexão após delay
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, reconnectDelay);
  };

  /* 
  ─────────────────────────────────────────────────────────────────────────────
                           PROCESSAMENTO DE MENSAGENS
  ─────────────────────────────────────────────────────────────────────────────
  */

  // Router principal para diferentes tipos de mensagens
  const handleMessage = (message: BackendMessage) => {
    console.log('Received WebSocket message:', message);
    
    // Switch baseado no tipo de mensagem
    switch (message.type) {
      case 'signal.update':
        handleSignalUpdate(message);
        break;
        
      case 'anomaly.alert':
        handleAnomalyAlert(message);
        break;
        
      case 'system.heartbeat':
        console.log('System heartbeat received:', message);
        // Aqui podias actualizar estado do sistema se necessário
        break;
      
      case "response.available_signals":
        if(Array.isArray(message.availableSignals)){
          setAvailableSignals(message.availableSignals);
        }
        break;
        
      case 'zmq.connected':
      case 'zmq.error':
      case 'zmq.warning':
      case 'zmq.heartbeat':
        console.log('ZeroMQ event:', message.type, message);
        // Eventos do ZeroMQ - para debug/monitorização
        break;
        
      case 'connection.established':
        console.log('Connection established:', message);
        // Confirmação de que o backend recebeu a conexão
        break;
        
      default:
        console.log('Unknown message type:', message);
    }
  };

  // Processar dados normais de sinais
  const handleSignalUpdate = (message: BackendSignalUpdate) => {
    const { signalType, dataType, timestamp, value, anomalies } = message;
    
    // Converter dados do backend para formato interno
    const signalPoint: SignalPoint = {
      timestamp,
      value,
      quality: 1.0, // Backend não envia quality ainda, assumir boa qualidade
      metadata: { dataType, source: 'backend' }
    };
    
    // Actualizar estado baseado no tipo de sinal
    switch (signalType) {
      case 'cardiac':
        // Actualizar dados cardíacos (ECG ou HR)
        setLatestCardiacData(prev => ({
          ...prev,  // Manter dados existentes
          [dataType]: signalPoint  // Actualizar só este tipo
        }));
        break;
        
      case 'eeg':
        // Mapear dataType para chaves mais simples
        setLatestEegData(prev => ({
          ...prev,
          [dataType === 'eegRaw' ? 'raw' : 'bands']: signalPoint
        }));
        break;
        
      case 'camera':
        setLatestCameraData(prev => ({
          ...prev,
          [dataType]: signalPoint
        }));
        break;
        
      case 'unity':
        setLatestUnityData(prev => ({
          ...prev,
          [dataType]: signalPoint
        }));
        break;
    }
    
    // Adicionar anomalias vindas com os dados (se existirem)
    if (anomalies && anomalies.length > 0) {
      setRecentAnomalies(prev => [
        ...anomalies.map(a => `${signalType}: ${a}`), // Prefixar com tipo de sinal
        ...prev  // Manter anomalias anteriores
      ].slice(0, 10)); // Manter apenas as últimas 10
    }
  };

  // Processar alertas específicos de anomalias
  const handleAnomalyAlert = (message: BackendAnomalyAlert) => {
    // Filtrar anomalias info (só mostrar warning e critical)
    if (message.severity === 'info') {
      return;
    }
    
    // Log com emoji para destacar
    console.warn(`🚨 ANOMALY: ${message.signalType} - ${message.message}`, message);
    
    // Formatar timestamp para exibição
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    
    // Emoji baseado na severidade
    const severityIcon = message.severity === 'critical' ? '🔴' : 
                        message.severity === 'warning' ? '🟡' : '🔵';
    
    // Criar mensagem formatada para o frontend
    const anomalyMessage = `${severityIcon} [${timestamp}] ${message.signalType}: ${message.message}`;
    
    // Adicionar à lista (no topo)
    setRecentAnomalies(prev => [anomalyMessage, ...prev].slice(0, 10));
  };

  /* 
  ─────────────────────────────────────────────────────────────────────────────
                                   EFFECTS
  ─────────────────────────────────────────────────────────────────────────────
  */

  // Auto-conectar quando o hook é montado ou URL muda
  useEffect(() => {
    connect();
    
    // Cleanup quando desmonta ou URL muda
    return () => {
      disconnect();
    };
  }, [url]); // Dependência: URL

  // Cleanup geral quando o hook é desmontado
  useEffect(() => {
    return () => {
      // Cancelar timeout se existir
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []); // Array vazio = só executa no mount/unmount

  /* 
  ─────────────────────────────────────────────────────────────────────────────
                                   RETORNO
  ─────────────────────────────────────────────────────────────────────────────
  */

  // Retornar tudo que o componente precisa
  return {
    // Dados mais recentes
    latestCardiacData,
    latestEegData,
    latestCameraData,
    latestUnityData,
    
    // Estado da conexão
    connectionStatus,
    
    // Anomalias
    recentAnomalies,

    availableSignals,
    
    // Controlo manual
    connect,
    disconnect
  };
};