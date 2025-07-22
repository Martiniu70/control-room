// src/hooks/useWebSocket.ts

import { useState, useEffect, useRef } from 'react';

/**
 * @file useWebSocket.ts
 * @description Provides a custom React hook for managing WebSocket connections
 * to receive real-time sensor data, anomaly alerts, and system health updates.
 */

/* ═══════════════════════════════════════════════════════════════════════════════
                               TYPES AND INTERFACES
═══════════════════════════════════════════════════════════════════════════════
*/

/**
 * Represents a single data point from a signal (e.g., ECG, HR, EEG).
 * @template T The type of the value.
 */
interface SignalPoint<T = any> {
  timestamp: number;           // Unix timestamp when the data was captured.
  value: T;                    // The actual data value (can be number, array, object).
  quality?: number;            // Optional signal quality (0.0 to 1.0).
  metadata?: Record<string, any>; // Optional additional information (source, type, etc.).
}

/**
 * Interface for normal data update messages from the backend.
 */
interface BackendSignalUpdate {
  type: 'signal.update';      // Message type identifier.
  signalType: 'cardiac' | 'eeg' | 'camera' | 'unity' | "sensors"; // Type of sensor.
  dataType: 'ecg' | 'hr' | 'eegRaw' | 'eegBands' | 'faceLandmarks' | 'blinks' | 'steering' | 'speed' | "accelerometer" | "gyroscope" | 'alcohol_level' | 'car_information'; // Specific data type.
  timestamp: number;          // Timestamp when the data was processed.
  value: any;                 // The data value.
  anomalies?: string[];       // Optional list of detected anomalies.
}

/**
 * Interface for specific anomaly alert messages from the backend.
 */
interface BackendAnomalyAlert {
  type: 'anomaly.alert';      // Specific type for anomalies.
  signalType: string;         // The signal type (cardiac, eeg, etc.).
  anomalyType: string;        // The specific anomaly type (bradycardia, electrode_loose, etc.).
  severity: string;           // Severity level (info, warning, critical).
  message: string;            // Descriptive message of the anomaly.
  timestamp: number;          // Timestamp when the anomaly was detected.
  value?: any;                // Optional value that caused the anomaly.
  threshold?: any;            // Optional threshold that was exceeded.
}

/**
 * Interface for system heartbeat messages from the backend.
 */
interface BackendSystemHeartbeat {
  type: 'system.heartbeat';   // Periodic heartbeat type.
  timestamp: string;          // System timestamp.
  systemHealth: any;          // General system health status.
  signalStatuses: any;        // Status of all signals.
  activeConnections: number;  // Number of active WebSocket clients.
  uptime: number;             // System uptime in seconds.
}

/**
 * Union type for all possible backend message types.
 */
type BackendMessage =
  | BackendSignalUpdate
  | BackendAnomalyAlert
  | BackendSystemHeartbeat
  | {
  type: 'zmq.connected' | 'zmq.error' | 'zmq.warning' | 'zmq.heartbeat' | 'connection.established';
  [key: string]: any; // Allows for additional properties.
};

/**
 * Represents the current status of the WebSocket connection.
 */
interface ConnectionStatus {
  connected: boolean;        // True if connected.
  reconnecting: boolean;     // True if attempting to reconnect.
  error: string | null;      // Error message if connection failed.
}

/**
 * Interface for the latest sensor data, including accelerometer and gyroscope.
 */
interface LatestSensorData{
  accelerometer?:SignalPoint;
  gyroscope?: SignalPoint;
}

/**
 * Interface for the latest camera data, including face landmarks and blinks.
 */
interface LatestCameraData {
  faceLandmarks?: SignalPoint; // Face landmarks data point.
  blinks?: SignalPoint;        // Blinks data point.
}

/**
 * Interface for 'unity' type data.
 */
interface LatestUnityData {
  steering?: SignalPoint;
  speed?: SignalPoint;
  alcohol_level?: SignalPoint<{ alcohol_level: number }>;
  car_information?: SignalPoint<{ car_information: { speed: number; lane_centrality: number } }>;
}


/**
 * The return type of the `useWebSocket` hook, providing access to
 * latest data, connection status, recent anomalies, and connection control functions.
 */
interface UseWebSocketReturn {
  latestCardiacData: { ecg?: SignalPoint; hr?: SignalPoint } | null;
  latestEegData: { raw?: SignalPoint; bands?: SignalPoint } | null;
  latestCameraData: LatestCameraData | null;
  latestUnityData: LatestUnityData | null;
  latestSensorData: LatestSensorData | null;
  connectionStatus: ConnectionStatus;
  recentAnomalies: string[];
  connect: () => void;
  disconnect: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════════
                               MAIN HOOK
═══════════════════════════════════════════════════════════════════════════════
*/

/**
 * Custom React hook for establishing and managing a WebSocket connection.
 * It provides real-time updates for various sensor data, anomaly alerts,
 * and connection status.
 *
 * @param url The WebSocket server URL. Defaults to 'ws://localhost:8000/api/ws'.
 * @returns An object containing the latest data, connection status,
 * recent anomalies, and functions to control the connection.
 */
export const useWebSocket = (
  url: string = 'ws://localhost:8000/api/ws'
): UseWebSocketReturn => {

  /* ─────────────────────────────────────────────────────────────────────────────
                                   LOCAL STATE
  ─────────────────────────────────────────────────────────────────────────────
  */

  // State to hold the latest cardiac signal data (ECG and HR).
  const [latestCardiacData, setLatestCardiacData] = useState<{ ecg?: SignalPoint; hr?: SignalPoint } | null>(null);
  // State to hold the latest EEG signal data (raw and bands).
  const [latestEegData, setLatestEegData] = useState<{ raw?: SignalPoint; bands?: SignalPoint } | null>(null);
  // State to hold the latest camera data (face landmarks and blinks).
  const [latestCameraData, setLatestCameraData] = useState<LatestCameraData | null>(null);
  // State to hold the latest Unity simulation data.
  const [latestUnityData, setLatestUnityData] = useState<LatestUnityData | null>(null);
  // State to hold the latest sensor data (accelerometer and gyroscope).
  const [latestSensorData, setLatestSensorData] = useState<LatestSensorData | null>(null);

  // State to track the WebSocket connection status.
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnecting: false,
    error: null
  });

  // State to store a list of recent anomaly alerts.
  const [recentAnomalies, setRecentAnomalies] = useState<string[]>([]);

  /* ─────────────────────────────────────────────────────────────────────────────
                                     REFS
  ─────────────────────────────────────────────────────────────────────────────
  */

  // Ref to store the WebSocket instance, allowing it to persist across re-renders.
  const wsRef = useRef<WebSocket | null>(null);
  // Ref to store the reconnection timeout ID, enabling clearing if needed.
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to track the number of reconnection attempts.
  const reconnectAttempts = useRef<number>(0);

  // Maximum number of reconnection attempts before giving up.
  const maxReconnectAttempts = 5;
  // Delay in milliseconds between reconnection attempts.
  const reconnectDelay = 3000;

  /* ─────────────────────────────────────────────────────────────────────────────
                              CONNECTION FUNCTIONS
  ─────────────────────────────────────────────────────────────────────────────
  */

  /**
   * Establishes a WebSocket connection to the specified URL.
   * Manages connection status and sets up event handlers.
   */
  const connect = () => {
    // If WebSocket is already open, prevent new connection attempts.
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      console.log(`Attempting to connect to WebSocket: ${url}`);

      // Create a new WebSocket instance.
      wsRef.current = new WebSocket(url);

      // Update connection status to indicate a reconnection attempt.
      setConnectionStatus(prev => ({ ...prev, reconnecting: true, error: null }));

      /* ┌─────────────────────────────────────────────────────────────────────────
      │                           EVENT HANDLERS
      └─────────────────────────────────────────────────────────────────────────
      */

      // Handler for successful WebSocket connection.
      wsRef.current.onopen = () => {
        console.log('WebSocket connected successfully');
        setConnectionStatus({
          connected: true,
          reconnecting: false,
          error: null
        });
        // Reset reconnection attempts on successful connection.
        reconnectAttempts.current = 0;
      };

      // Handler for incoming WebSocket messages.
      wsRef.current.onmessage = (event) => {
        try {
          // Parse the incoming message as a BackendMessage.
          const message: BackendMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      // Handler for WebSocket closure.
      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus(prev => ({
          ...prev,
          connected: false,
          error: event.reason || 'Connection closed'
        }));

        // Attempt to reconnect if within the maximum allowed attempts.
        if (reconnectAttempts.current < maxReconnectAttempts) {
          scheduleReconnect();
        } else {
          // If max attempts reached, update status to reflect failure.
          setConnectionStatus(prev => ({
            ...prev,
            reconnecting: false,
            error: 'Max reconnection attempts reached'
          }));
        }
      };

      // Handler for WebSocket errors.
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

  /**
   * Closes the WebSocket connection and clears any pending reconnection timeouts.
   */
  const disconnect = () => {
    // Clear any active reconnection timeout.
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close the WebSocket connection if it exists.
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Reset connection status.
    setConnectionStatus({
      connected: false,
      reconnecting: false,
      error: null
    });
  };

  /**
   * Schedules a reconnection attempt after a defined delay.
   * Increments the reconnection attempt count.
   */
  const scheduleReconnect = () => {
    // Clear any existing reconnection timeout to prevent multiple attempts.
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttempts.current += 1; // Increment attempt count.

    // Update connection status to show reconnection progress.
    setConnectionStatus(prev => ({
      ...prev,
      reconnecting: true,
      error: `Reconnecting... (${reconnectAttempts.current}/${maxReconnectAttempts})`
    }));

    // Set a timeout to call the connect function after the delay.
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, reconnectDelay);
  };

  /* ─────────────────────────────────────────────────────────────────────────────
                           MESSAGE PROCESSING
  ─────────────────────────────────────────────────────────────────────────────
  */

  /**
   * Handles incoming messages from the WebSocket, directing them to appropriate handlers
   * based on their `type` property.
   * @param message The parsed `BackendMessage` received from the WebSocket.
   */
  const handleMessage = (message: BackendMessage) => {
    console.log('Received WebSocket message:', message);

    switch (message.type) {
      case 'signal.update':
        handleSignalUpdate(message);
        break;

      case 'anomaly.alert':
        handleAnomalyAlert(message);
        break;

      case 'system.heartbeat':
        // System heartbeat messages are often logged for debugging but can be verbose.
        // console.log('System heartbeat received:', message);
        break;

      case 'zmq.connected':
      case 'zmq.error':
      case 'zmq.warning':
      case 'zmq.heartbeat':
      case 'connection.established':
        console.log('ZeroMQ event or connection status:', message.type, message);
        break;

      default:
        console.log('Unknown message type:', message);
    }
  };

  /**
   * Processes `BackendSignalUpdate` messages, updating the relevant state
   * with the latest signal data.
   * @param message The `BackendSignalUpdate` message.
   */
  const handleSignalUpdate = (message: BackendSignalUpdate) => {
    const { signalType, dataType, timestamp, value, anomalies } = message;

    // Create a SignalPoint object from the message data.
    const signalPoint: SignalPoint = {
      timestamp,
      value,
    };

    // Update the appropriate state based on the signalType and dataType.
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
        setLatestCameraData(prev => {
          const newCameraData = { ...prev };
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

    // If anomalies are present in the signal update, add them to recentAnomalies.
    if (anomalies && anomalies.length > 0) {
      setRecentAnomalies(prev => [
        ...anomalies.map(a => `${signalType}: ${a}`),
        ...prev
      ].slice(0, 10)); // Keep only the 10 most recent anomalies.
    }
  };

  /**
   * Processes `BackendAnomalyAlert` messages, formatting and adding them to
   * the `recentAnomalies` state. 'info' level anomalies are ignored.
   * @param message The `BackendAnomalyAlert` message.
   */
  const handleAnomalyAlert = (message: BackendAnomalyAlert) => {
    // Ignore 'info' level anomaly alerts to reduce noise.
    if (message.severity === 'info') {
      return;
    }

    console.warn(`🚨 ANOMALY: ${message.signalType} - ${message.message}`, message);

    // Format the timestamp for display.
    const timestamp = new Date(message.timestamp).toLocaleTimeString();

    // Determine an appropriate icon based on severity.
    const severityIcon = message.severity === 'critical' ? '🔴' :
                        message.severity === 'warning' ? '🟡' : '🔵';

    // Construct the anomaly message string.
    const anomalyMessage = `${severityIcon} [${timestamp}] ${message.signalType}: ${message.message}`;

    // Add the new anomaly message to the state, keeping only the 10 most recent.
    setRecentAnomalies(prev => [anomalyMessage, ...prev].slice(0, 10));
  };

  /* ─────────────────────────────────────────────────────────────────────────────
                                   EFFECTS
  ─────────────────────────────────────────────────────────────────────────────
  */

  /**
   * useEffect to establish WebSocket connection on component mount
   * and close it on unmount. Re-connects if the URL changes.
   */
  useEffect(() => {
    connect(); // Initiate connection when the component mounts.

    // Cleanup function: disconnects the WebSocket when the component unmounts.
    return () => {
      disconnect();
    };
  }, [url]); // Dependency array: re-run effect if 'url' changes.

  /**
   * useEffect to ensure any pending reconnection timeouts are cleared
   * if the component unmounts unexpectedly.
   */
  useEffect(() => {
    // Cleanup function: clears the reconnect timeout when the component unmounts.
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array means this effect runs only once on mount and cleanup on unmount.

  /* ─────────────────────────────────────────────────────────────────────────────
                                   RETURN VALUE
  ─────────────────────────────────────────────────────────────────────────────
  */

  /**
   * Returns the state and functions provided by the hook for consumption
   * by React components.
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