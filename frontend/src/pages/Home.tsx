// frontend/src/pages/Home.tsx
import React, { useEffect, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface SignalPoint {
  timestamp: number;
  value: number;
}

interface SimulatorData {
  ecg: SignalPoint | null;
  eeg: SignalPoint | null;
  ppg: SignalPoint | null;
}

const MAX_POINTS = 20; // número máximo de pontos a mostrar

const Home: React.FC = () => {
  // liga ao WS e recebe objetos { ecg, eeg, ppg }
  const { data } = useWebSocket<SimulatorData>(
    "ws://localhost:8000/ws/simulator/latest"
  );

  // estados para armazenar histórico de cada sinal
  const [ecgData, setEcgData] = useState<SignalPoint[]>([]);
  const [eegData, setEegData] = useState<SignalPoint[]>([]);
  const [ppgData, setPpgData] = useState<SignalPoint[]>([]);

  // sempre que chega um novo pacote de dados, atualizar cada array
  useEffect(() => {
    if (!data) return;

    const append = <T extends SignalPoint>(
      prev: T[],
      point: T | null,
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      if (!point) return;
      const next = [...prev, point].slice(-MAX_POINTS);
      setter(next);
    };

    append(ecgData, data.ecg, setEcgData);
    append(eegData, data.eeg, setEegData);
    append(ppgData, data.ppg, setPpgData);
  }, [data]);

  // função para formatar timestamp para segundos relativos
  const formatTime = (ts: number) => {
    return new Date(ts * 1000).toLocaleTimeString();
  };

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-3xl font-bold">Control Room Dashboard</h1>

      {/* ECG */}
      <div>
        <h2 className="text-xl font-semibold mb-2">ECG (bpm)</h2>
        <LineChart width={600} height={200} data={ecgData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            domain={["auto", "auto"]}
            type="number"
          />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip
            labelFormatter={(val) =>
              `Hora: ${formatTime(val as number)}`
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#8884d8"
            dot={false}
          />
        </LineChart>
      </div>

      {/* EEG */}
      <div>
        <h2 className="text-xl font-semibold mb-2">
          EEG (ondas cerebrais)
        </h2>
        <LineChart width={600} height={200} data={eegData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            domain={["auto", "auto"]}
            type="number"
          />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip
            labelFormatter={(val) =>
              `Hora: ${formatTime(val as number)}`
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#82ca9d"
            dot={false}
          />
        </LineChart>
      </div>

      {/* PPG */}
      <div>
        <h2 className="text-xl font-semibold mb-2">PPG (pulse)</h2>
        <LineChart width={600} height={200} data={ppgData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            domain={["auto", "auto"]}
            type="number"
          />
          <YAxis domain={["auto", "auto"]} />
          <Tooltip
            labelFormatter={(val) =>
              `Hora: ${formatTime(val as number)}`
            }
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#ff7300"
            dot={false}
          />
        </LineChart>
      </div>
    </div>
  );
};

export default Home;
