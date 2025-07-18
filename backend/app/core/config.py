"""
Configurações 

Resumo:
Mantem todas as configurações da nossa aplicação quer seja portas, websocket, sinais, debug etc
Divido por classes correspondentes ZeroMQConfig, WebScoketConfig e SignalConfig

Deve ter TODOS os thresholds e configurações específicas de cada sinal,teste, scokets etc... 
objetivo de centralizar tudo para ser mais facil da debug / fazer alterações. 

URLs disponíveis:

http://localhost:8000/ - Página principal da API
http://localhost:8000/docs - Documentação automática
http://localhost:8000/api/status - Status do sistema
ws://localhost:8000/ws - WebSocket para os dados em tempo real
"""

import logging
import os
from typing import Dict, List

class ZeroMQConfig:
    """Configurações ZeroMQ"""
    def __init__(self):
        # Configurações básicas de conexão PUB/SUB
        # Endereço do PC do SIM: 192.168.1.103
        # Endereço do PC Martim: 192.168.1.79
        self.publisherAddress = os.getenv('ZMQ_PUBLISHER_ADDRESS', '192.168.1.103')   # IP do endereço a emitir o ZEROMQ
        self.subscriberPort = int(os.getenv('ZMQ_SUBSCRIBER_PORT', 22881))           # Port SINK_SUB_ADDR
        self.timeout = int(os.getenv('ZMQ_TIMEOUT', 1000))                           # Timeout em milissegundos
        # URL completo para conexão
        self.fullSubscriberUrl = f"tcp://{self.publisherAddress}:{self.subscriberPort}"
        
        # Tópicos para subscrever (todos os tópicos disponíveis)
        self.topics = [
            "Polar_PPI",           # Dados do Polar ARM Band
            "CardioWheel_ECG",     # ECG do CardioWheel  
            "CardioWheel_ACC",     # Acelerómetro do CardioWheel
            "CardioWheel_GYR",     # Giroscópio do CardioWheel
            "BrainAcess_EEG",      # EEG do BrainAccess Halo
            "Control",             # Sinais de controlo
            "Timestamp",           # Timestamps do sistema
            "Cfg"                  # Configurações dos dispositivos
        ]

        # Tipos de dados reconhecidos por tópico
        self.recognizedDataTypes = {
            "Polar_PPI": ["hr", "ppi", "error_ms", "flags"],
            "CardioWheel_ECG": ["ecg"],
            "CardioWheel_ACC": ["accelerometer"],
            "CardioWheel_GYR": ["gyroscope"],
            "BrainAcess_EEG": ["eegRaw"],
            "Control": ["system"],
            "Timestamp": ["system"],
            "Cfg": ["system"]
        }

        # Configurações de debug e logging específicas por tópico
        self.topicLogLevels = {
            "Polar_PPI": "INFO",        # Log normal para Polar
            "CardioWheel_ECG": "DEBUG", # Log detalhado para ECG
            "CardioWheel_ACC": "INFO", # Só avisos para acelerómetro
            "CardioWheel_GYR": "WARNING", # Só avisos para giroscópio  
            "BrainAcess_EEG": "INFO",   # Log normal para EEG
            "Control": "INFO",          # Log normal para controlo
            "Timestamp": "WARNING",     # Só avisos para timestamps
            "Cfg": "INFO"               # Log normal para configurações
        }

        # Configurações de socket
        self.lingerTime = 1000                      # Tempo para fechar socket  (ms)
        self.receiveHighWaterMark = 1000            # Limite de mensagens em buffer
        self.socketType = "SUB"                     # Tipo de socket (SUB para receber)
        
        # Configurações de reconexão
        self.maxReconnectAttempts = 10              # Número máximo de tentativas de reconexão
        self.reconnectDelay = 5.0                   # Segundos entre tentativas de reconexão
        
        # Configurações de timeout e monitorização
        self.messageTimeout = 10.0                  # Segundos sem mensagens antes de alarme
        self.heartbeatInterval = 30.0               # Segundos entre heartbeats
        
        # Configurações de validação de mensagens
        self.maxTimestampDifference = 86400         # Segundos máximos de diferença de timestamp (24h)
        
        # Configurações de performance
        self.processingTimeoutWarning = 0.1         # Segundos - avisar se processamento demorar mais
        self.errorRateWarningThreshold = 0.1        # 10% - avisar se taxa de erro for superior
        self.rejectionRateWarningThreshold = 0.2    # 20% - avisar se taxa de rejeição for superior

        # Mapeamento de tópicos para tipos de sinal e dados
        self.topicToSignalMapping = {
            "Polar_PPI": {"signalType": "cardiac", "dataType": "ppi"},
            "CardioWheel_ECG": {"signalType": "cardiac", "dataType": "ecg"},
            "CardioWheel_ACC": {"signalType": "sensors", "dataType": "accelerometer"},
            "CardioWheel_GYR": {"signalType": "sensors", "dataType": "gyroscope"},
            "BrainAcess_EEG": {"signalType": "eeg", "dataType": "eegRaw"},
            "Control": {"signalType": "system", "dataType": "control"},
            "Timestamp": {"signalType": "system", "dataType": "timestamp"},
            "Cfg": {"signalType": "system", "dataType": "config"}
        }

        # Configurações de processamento específicas por tópico
        self.topicProcessingConfig = {
            "Polar_PPI": {
                "ppiToHrConversion": True,
                "ppiToHrFactor": 60000.0,           # 60000ms / PPI_ms = BPM
                "validPpiRange": (300, 2000),       # ms (30-200 BPM)
                "timestampUnit": "seconds"          # Unidade do timestamp
            },
            "CardioWheel_ECG": {
                "samplingRate": 1000,               # Hz
                "expectedChunkSize": 20,            # Pontos por chunk típico
                "timestampIncrement": 0.001,        # 1ms por sample (1/1000Hz)
                "ecgValueKey": "ECG",               # Campo com valores ECG
                "lodValueKey": "LOD",               # Campo LOD (ignorado por enquanto)
                "timestampUnit": "seconds"
            },
            "CardioWheel_ACC": {
                "samplingRate": 100,                # Hz estimado
                "axes": ["X", "Y", "Z"],            # Eixos do acelerómetro
                "timestampUnit": "seconds"
            },
            "CardioWheel_GYR": {
                "samplingRate": 100,                # Hz estimado  
                "axes": ["X", "Y", "Z"],            # Eixos do giroscópio
                "timestampUnit": "seconds"
            },
            "BrainAcess_EEG": {
                "samplingRate": 250,                # Hz
                "channels": ["ch0", "ch1", "ch2", "ch3"],  #  ch0-ch3 conforme CSVs
                "expectedChunkSize": 10,            # Pontos por chunk típico
                "timestampIncrement": 0.004,        # 4ms por sample (1/250Hz)
                "timestampUnit": "seconds"
            },
            "Control": {
                "expectedFrequency": 0.1,           # Mensagens ocasionais - TODO averiguar utilidade
                "dataFormat": "msgpack"
            },
            "Timestamp": {
                "expectedFrequency": 0.2,           # Timestamps ocasionais - TODO averiguar utilidade
                "dataFormat": "msgpack"
            },
            "Cfg": {
                "expectedFrequency": 0.05,          # Configurações - TODO averiguar utilidade
                "dataFormat": "msgpack"
            }
        }
            
        # Configurações de validação de dados por tópico 
        # Estrutura real: {"ts": "...", "labels": [...], "data": [[...], [...]]}
        self.topicValidationConfig = {
            "Polar_PPI": {
                "requiredFields": ["ts", "labels", "data"],
                "optionalFields": [],
                "expectedLabels": ["error_ms", "flags", "value"],  # Sem HR - só PPI
                "valueRanges": {
                    "value": (300, 2000),           # PPI em ms
                    "error_ms": (0, 1000),          # Erro em ms
                    "flags": (0, 255)               # Flags de estado
                }
            },
            "CardioWheel_ECG": {
                "requiredFields": ["ts", "labels", "data"],
                "optionalFields": [],
                "expectedLabels": ["ECG", "LOD"],   # Conforme CSV
                "valueRanges": {
                    "ECG": (-32768, 32767),         # Valores típicos 16-bit
                    "LOD": (0, 1)                   # Lead-off detection
                }
            },
            "BrainAcess_EEG": {
                "requiredFields": ["ts", "labels", "data"],
                "optionalFields": [],
                "expectedLabels": ["ch0", "ch1", "ch2", "ch3"],  # Conforme CSV
                "valueRanges": {
                    "ch0": (-200.0, 200.0),         # μV
                    "ch1": (-200.0, 200.0),
                    "ch2": (-200.0, 200.0),
                    "ch3": (-200.0, 200.0)
                }
            },
            "CardioWheel_ACC": {
                "requiredFields": ["ts", "labels", "data"],
                "optionalFields": [],
                "expectedLabels": ["X", "Y", "Z"],  # Conforme CSV
                "valueRanges": {
                    "X": (-32768, 32767),           # Valores típicos 16-bit
                    "Y": (-32768, 32767),
                    "Z": (-32768, 32767)
                }
            },
            "CardioWheel_GYR": {
                "requiredFields": ["ts", "labels", "data"],
                "optionalFields": [],
                "expectedLabels": ["X", "Y", "Z"],  # Conforme CSV
                "valueRanges": {
                    "X": (-32768, 32767),           # Valores típicos 16-bit
                    "Y": (-32768, 32767),
                    "Z": (-32768, 32767)
                }
            },
            "Control": {
                "requiredFields": ["ts"],           # TODO averiguar campos necessários
                "optionalFields": ["labels", "data", "*"]  # Aceitar qualquer campo por enquanto
            },
            "Timestamp": {
                "requiredFields": ["ts"],           # TODO averiguar se há mais campos
                "optionalFields": ["labels", "data", "ctrl_ts"]
            },
            "Cfg": {
                "requiredFields": [],               # TODO averiguar campos necessários
                "optionalFields": ["*"]             # Aceitar qualquer campo por enquanto
            }
        }
                # Log configuração ao inicializar
        if os.getenv('DEBUG', 'False').lower() in ('true', '1', 'yes'):
            print(f"ZeroMQ PUB/SUB Config:")
            print(f"  Publisher: {self.publisherAddress}:{self.subscriberPort}")
            print(f"  Topics: {len(self.topics)} configured")
            print(f"  Primary topics: Polar_PPI, CardioWheel_ECG, BrainAcess_EEG")
            print(f"  Timeout: {self.timeout}ms, Message timeout: {self.messageTimeout}s")

class MockZeroMQConfig:
    """Configurações para sistema mock ZeroMQ"""
    def __init__(self):
        # Configurações do publisher mock
        self.mockPublisherAddress = os.getenv('MOCK_ZMQ_PUBLISHER_ADDRESS', '127.0.0.1')  # Local
        self.mockPublisherPort = int(os.getenv('MOCK_ZMQ_PUBLISHER_PORT', 22882))          # Diferente do real
        self.mockPublisherUrl = f"tcp://{self.mockPublisherAddress}:{self.mockPublisherPort}"
        
        # Configurações de socket mock
        self.mockLingerTime = 1000                  # ms
        self.mockSendHighWaterMark = 1000          # Limite de mensagens em buffer
        self.mockSocketType = "PUB"                # Tipo de socket (PUB para enviar)
        
        # Frequências de publicação por tópico (Hz)
        self.topicFrequencies = {
            "Polar_PPI": 1.0,                      # 1Hz - eventos de batimento cardíaco
            "CardioWheel_ECG": 50.0,               # 50Hz - chunks de ECG (1000Hz real / 20 samples por chunk)
            "CardioWheel_ACC": 10.0,               # 10Hz - chunks de acelerómetro (100Hz real / 10 samples por chunk)
            "CardioWheel_GYR": 10.0,               # 10Hz - chunks de giroscópio (100Hz real / 10 samples por chunk)
            "BrainAcess_EEG": 25.0,                # 25Hz - chunks de EEG (250Hz real / 10 samples por chunk)
            "Control": 0.1,                        # 0.1Hz - mensagens de controlo ocasionais
            "Timestamp": 0.2,                      # 0.2Hz - timestamps ocasionais
            "Cfg": 0.05                            # 0.05Hz - configurações raras
        }
        
        # Configurações de chunk por tópico (quantos samples por mensagem)
        self.topicChunkSizes = {
            "Polar_PPI": 1,                        # 1 evento PPI por mensagem
            "CardioWheel_ECG": 20,                 # 20 samples ECG por chunk (20ms @ 1000Hz)
            "CardioWheel_ACC": 10,                 # 10 samples ACC por chunk (100ms @ 100Hz)
            "CardioWheel_GYR": 10,                 # 10 samples GYR por chunk (100ms @ 100Hz)
            "BrainAcess_EEG": 10,                  # 10 samples EEG por chunk (40ms @ 250Hz)
            "Control": 1,                          # 1 mensagem de controlo
            "Timestamp": 1,                        # 1 timestamp
            "Cfg": 1                               # 1 configuração
        }
        
        # Configurações de anomalias mock
        self.anomalyInjection = {
            "enabled": True,                       # Ativar injeção de anomalias
            "globalChance": 0.02,                  # 2% chance global por ciclo
            "minInterval": 10.0,                   # Segundos mínimos entre anomalias
            "maxAnomaliesPerMinute": 3,            # Máximo de anomalias por minuto
            "topicChances": {                      # Chances específicas por tópico
                "Polar_PPI": 0.05,                 # 5% chance para HR
                "CardioWheel_ECG": 0,        # 0.005% chance para ECG
                "CardioWheel_ACC": 0.0005,         # 0.05% chance para ACC
                "CardioWheel_GYR": 0.0005,         # 0.05% chance para GYR
                "BrainAcess_EEG": 0.0002           # 0.02% chance para EEG
            }
        }
        
        # Configurações de dados base para geradores
        self.generatorBaseConfig = {
            "cardiac": {
                "baseHr": 75,                      # BPM base
                "hrVariationStd": 5,               # Desvio padrão da variação HR
                "ecgAmplitudeBase": 1650,          # Valor baseline ADC para ECG
                "ecgNoiseStd": 10                  # Ruído ADC para ECG
            },
            "accelerometer": {
                "baselineX": 7500,                 # Baseline ADC para X
                "baselineY": 0,                    # Baseline ADC para Y
                "baselineZ": 3100,                 # Baseline ADC para Z (inclui gravidade)
                "noiseStd": 5                      # Ruído ADC
            },
            "gyroscope": {
                "baselineX": 0,                    # Baseline ADC para X
                "baselineY": 0,                    # Baseline ADC para Y
                "baselineZ": 0,                    # Baseline ADC para Z
                "noiseStd": 2                      # Ruído ADC
            },
            "eeg": {
                "channelCount": 4,                 # Número de canais
                "channelNames": ["ch0", "ch1", "ch2", "ch3"],
                "amplitudeBase": 20,               # Amplitude base μV
                "noiseStd": 5                      # Ruído μV
            }
        }
        
        # Configurações de timing e sincronização
        self.timingConfig = {
            "timestampFormat": "float",            # Formato do timestamp (float em segundos)
            "timestampPrecision": 3,               # Casas decimais no timestamp
            "chunkTimingJitter": 0.001,            # Jitter máximo entre chunks (1ms)
            "systemStartTime": None,               # Será definido no arranque
            "useRealtimeTimestamps": True          # Usar timestamps de tempo real
        }
        
        # Configurações de debug específicas para mock
        self.debugConfig = {
            "enableTopicFiltering": True,          # Permitir filtrar tópicos específicos
            "logAllMessages": False,               # Log de todas as mensagens (verbose)
            "logMessageSizes": True,               # Log do tamanho das mensagens
            "logTimingStats": True,                # Log de estatísticas de timing
            "validateMessageFormat": True,         # Validar formato antes de enviar
            "topicDebugLevels": {                  # Níveis de debug por tópico
                "Polar_PPI": "INFO",
                "CardioWheel_ECG": "DEBUG",
                "CardioWheel_ACC": "INFO",
                "CardioWheel_GYR": "INFO",
                "BrainAcess_EEG": "INFO",
                "Control": "WARNING",
                "Timestamp": "WARNING",
                "Cfg": "WARNING"
            }
        }
        
        # Configurações de performance e limites
        self.performanceConfig = {
            "maxMessagesPerSecond": 200,           # Limite global de mensagens/segundo
            "maxMessageSize": 10240,               # Tamanho máximo da mensagem (10KB)
            "bufferSize": 1000,                    # Tamanho do buffer de envio
            "batchSendEnabled": False,             # Envio em lote (para otimização futura)
            "compressionEnabled": False,           # Compressão de mensagens (para otimização futura)
            "metricsUpdateInterval": 5.0           # Intervalo de atualização de métricas
        }
        
        # Log configuração ao inicializar se debug ativo
        if os.getenv('DEBUG', 'False').lower() in ('true', '1', 'yes'):
            print(f"Mock ZeroMQ Config:")
            print(f"  Publisher: {self.mockPublisherUrl}")
            print(f"  Topics: {list(self.topicFrequencies.keys())}")
            print(f"  Frequencies: ECG={self.topicFrequencies['CardioWheel_ECG']}Hz, PPI={self.topicFrequencies['Polar_PPI']}Hz")
            print(f"  Anomalies: {'Enabled' if self.anomalyInjection['enabled'] else 'Disabled'}")

class WebSocketConfig:
    """Configurações WebSocket"""
    def __init__(self):
        self.updateInterval = float(os.getenv('WS_UPDATE_INTERVAL', 0.1))   # Intervalo a que o websocket dá refresh
        self.maxConnections = int(os.getenv('WS_MAX_CONNECTIONS', 10))      # Permite 10 dispostivios conectados ao backend ao mesmo tempo

class SignalConfig:
    """Configurações dos sinais"""
    def __init__(self):
        self.bufferSeconds = int(os.getenv('BUFFER_SECONDS', 30))
        
        # Configurações cardíacas COMPLETAS
        self.cardiacConfig = {
            "ecg": {
                "samplingRate": 1000,
                "bufferSize": 30000,  # 30s * 1000Hz
                "normalEcgRange": (-5.0, 5.0),  # mV típico para ECG
                # Thresholds de anomalias ECG
                "lowAmplitudeThreshold": 0.1,    # mV - eletrodo solto
                "highAmplitudeThreshold": 8.0,   # mV - saturação
                "flatThreshold": 0.01,           # std mV - sinal plano
                "driftThreshold": 1.0            # mV - deriva baseline
            },
            "hr": {
                "samplingRate": "event",
                "bufferSize": 100,
                "normalRange": (60, 100),
                "criticalRange": (30, 200),         # Range absoluto para validação
                # Thresholds de anomalias HR
                "bradycardiaThreshold": 60,         # bpm
                "tachycardiaThreshold": 100,        # bpm
                "severeBradycardiaThreshold": 40,   # bpm
                "severeTachycardiaThreshold": 150,  # bpm
                "highVariabilityThreshold": 40,    # bpm - variabilidade extrema
                "suddenChangeThreshold": 30        # bpm - mudança súbita
            },
            "ppi": {
                # Nova configuração específica para dados PPI do Polar
                "samplingRate": "event",
                "bufferSize": 200,
                "normalRange": (400, 1500),      # ms (40-150 BPM)
                "criticalRange": (300, 2000),    # ms (30-200 BPM)
                # Thresholds específicos para PPI
                "lowPpiThreshold": 1000,         # ms (>60 BPM)
                "highPpiThreshold": 600,         # ms (<100 BPM)
                "ppiVariabilityThreshold": 200,  # ms - variação excessiva
                "errorThreshold": 100            # ms - erro aceitável na medição
            }
        }
        
        # Configurações EEG COMPLETAS
        self.eegConfig = {
            "raw": {
                "channels": 4, 
                "samplingRate": 250, 
                "bufferSize": 7500,                 # 7500 por canal - TODO verificar se é por canal ou total
                "channelNames": ["ch0", "ch1", "ch2", "ch3"],  # CORRIGIDO: ch0-ch3 conforme CSVs
                "normalRange": (-200.0, 200.0),     # μV típico para EEG
                "saturationThreshold": 150.0,       # μV - saturação
                # Thresholds de anomalias EEG Raw
                "minChannelStd": 1.0,               # μV - mínimo para sinal ativo
                "maxChannelAmplitude": 180.0,       # μV - máximo para artefactos
                "maxBaselineDrift": 50.0            # μV - deriva DC
            },
            "bands": {
                "samplingRate": 5,
                "bufferSize": 150, 
                "bandNames": ["delta", "theta", "alpha", "beta", "gamma"],
                # Power bands tolerância e ranges
                "powerBandsTolerance": 0.1,         # ±10% para soma = 1.0
                "expectedBandRanges": {
                    "delta": (0.05, 0.50),          # 5-50% em estados normais
                    "theta": (0.05, 0.40),          # 5-40%
                    "alpha": (0.10, 0.60),          # 10-60% (dominante em relaxamento)
                    "beta": (0.05, 0.50),           # 5-50%
                    "gamma": (0.01, 0.30)           # 1-30%
                },
                # Thresholds de anomalias Power Bands
                "deltaExcessThreshold": 0.7,        # 70% delta = sonolência
                "alphaDeficitThreshold": 0.05,      # <5% alfa = stress
                "betaExcessThreshold": 0.6,         # >60% beta = ansiedade
                "bandChangeThreshold": 0.3          # 30% mudança súbita
            },

            "brainStates": {
                "availableStates": ["relaxed", "alert", "drowsy", "sleepy", "neutral"],
                "defaultState": "neutral",
                "stateBandTemplates": {
                    "relaxed": {"delta": 0.15, "theta": 0.20, "alpha": 0.45, "beta": 0.15, "gamma": 0.05},
                    "alert": {"delta": 0.10, "theta": 0.15, "alpha": 0.25, "beta": 0.40, "gamma": 0.10},
                    "drowsy": {"delta": 0.50, "theta": 0.25, "alpha": 0.15, "beta": 0.08, "gamma": 0.02},
                    "sleepy": {"delta": 0.20, "theta": 0.40, "alpha": 0.25, "beta": 0.12, "gamma": 0.03},
                    "neutral": {"delta": 0.25, "theta": 0.25, "alpha": 0.25, "beta": 0.20, "gamma": 0.05}
                }
            }
        }

        # Configurações de sensores COMPLETAS
        self.sensorsConfig = {
            "accelerometer": {
                "samplingRate": 100,                    # Hz conforme CardioWheel
                "bufferSize": 3000,                     # 30s * 100Hz
                "normalRange": (-32768, 32767),         # Valores 16-bit ADC
                "physicalRange": (-156.8, 156.8),      # ±16g em m/s² após conversão
                "axes": ["x", "y", "z"],                # Eixos do acelerómetro
                "conversionFactor": 0.0048,             # ADC para m/s² (aprox 16g/32768)
                "baselineOffset": 0,                    # Offset para calibração
                # Thresholds de anomalias ACC
                "suddenMovementThreshold": 50.0,        # m/s² - movimento brusco
                "highVibrationsThreshold": 20.0,        # m/s² std - vibrações excessivas
                "magnitudeThreshold": 100.0,            # m/s² - magnitude total excessiva
                "lowActivityThreshold": 1.0,            # m/s² - sinal muito plano
                "impactThreshold": 120.0,               # m/s² - possível impacto
                "sustainedAccelThreshold": 80.0         # m/s² - aceleração sustentada
            },
            "gyroscope": {
                "samplingRate": 100,                    # Hz conforme CardioWheel
                "bufferSize": 3000,                     # 30s * 100Hz  
                "normalRange": (-32768, 32767),         # Valores 16-bit ADC
                "physicalRange": (-2000.0, 2000.0),    # ±2000°/s após conversão
                "axes": ["x", "y", "z"],                # Eixos do giroscópio
                "conversionFactor": 0.061,              # ADC para °/s (aprox 2000°/s / 32768)
                "baselineOffset": 0,                    # Offset para calibração
                # Thresholds de anomalias GYR
                "rapidRotationThreshold": 500.0,        # °/s - rotação rápida
                "instabilityThreshold": 100.0,          # °/s std - instabilidade
                "angularMagnitudeThreshold": 800.0,     # °/s - magnitude angular excessiva
                "lowActivityThreshold": 2.0,            # °/s - sinal muito plano
                "spinThreshold": 1000.0,                # °/s - possível spin/derrapagem
                "sustainedRotationThreshold": 300.0     # °/s - rotação sustentada
            },
            "combined": {
                # Análises combinadas ACC+GYR
                "aggressiveDrivingCombo": {
                    "accThreshold": 30.0,               # m/s² simultâneo
                    "gyrThreshold": 200.0,              # °/s simultâneo
                    "durationThreshold": 2.0            # segundos mínimos
                },
                "emergencyBrakingCombo": {
                    "accThreshold": -60.0,              # m/s² negativo (desaceleração)
                    "gyrStabilityMax": 50.0,            # °/s máximo (sem rotação)
                    "durationMin": 1.0                  # segundos mínimos
                },
                "cornering": {
                    "accLateralMin": 15.0,              # m/s² lateral mínimo
                    "gyrYawMin": 100.0,                 # °/s yaw mínimo
                    "combinedMagnitudeMin": 50.0        # magnitude combinada
                }
            }
        }
        
        # TODO Configurações câmera
        self.cameraConfig = {
            "videoStream": {
                "fps": 30, 
                "bufferSize": 900,
                "resolution": (640, 480),           # Resolução padrão
                "qualityThreshold": 0.7             # Qualidade mínima para processamento
            },
            "landmarks": {
                "dimensions": 1434,                 # 478 pontos * 3 coordenadas
                "bufferSize": 900,
                "detectionThreshold": 0.5,          # Confiança mínima para landmarks
                "stabilityThreshold": 10.0          # Pixels - movimento máximo entre frames
            },
            "blinkRate": {
                "samplingRate": "event", 
                "bufferSize": 100,
                "normalRange": (10, 30),            # Blinks por minuto
                "drowsinessThreshold": 5            # <5 blinks/min = sonolência
            }
        }
        
        # TODO Configurações Unity
        self.unityConfig = {
            "steering": {
                "samplingRate": 50, 
                "bufferSize": 1500,
                "normalRange": (-45.0, 45.0),       # Graus
                "suddenChangeThreshold": 15.0       # Graus por segundo
            },
            "speed": {
                "samplingRate": 10, 
                "bufferSize": 300,
                "normalRange": (0, 120),            # km/h
                "speedingThreshold": 100,           # km/h
                "suddenChangeThreshold": 20.0       # km/h por segundo
            },
            "throttleBrakes": {
                "samplingRate": 50, 
                "bufferSize": 1500,
                "normalRange": (0.0, 1.0),          # Percentagem 0-100%
                "aggressiveThreshold": 0.9          # >90% = agressivo
            },
            "laneCentrality": {
                "samplingRate": 10, 
                "bufferSize": 300,
                "normalRange": (0.3, 1.0),          # 0=fora da faixa, 1=centro
                "dangerThreshold": 0.2,             # <20% = perigoso
                "warningThreshold": 0.4             # <40% = aviso
            },
            "proximityNpcs": {
                "samplingRate": 10, 
                "bufferSize": 300,
                "safeDistance": 20.0,               # Metros
                "warningDistance": 10.0,            # Metros
                "dangerDistance": 5.0               # Metros
            }
        }

        # Configurações de streaming e mock generators
        self.streamingConfig = {
            "cardiacEcgFrequency": 10,        # Hz - streaming ECG
            "cardiacHrFrequency": 1,          # Hz - streaming HR  
            "eegRawFrequency": 25,            # Hz - streaming EEG raw
            "eegBandsFrequency": 5,           # Hz - streaming power bands (corrigir de 0.2)
            "anomalyInjectionChance": 0.02,   # 2% chance de injetar anomalias
            "systemHeartbeatInterval": 5.0,   # segundos - heartbeat do sistema
            "anomalyMinInterval": 10.0        # segundos - intervalo mínimo entre anomalias
        }

        self.mockConfig = {
            "cardiac": {
                # Configurações base
                "baseHr": 75,                     # BPM base para simulação normal
                "anomalyChance": 0.05,            # 5% chance de anomalia natural
                "hrVariationStd": 5,              # desvio padrão da variação HR normal
                
                # Parâmetros de geração ECG
                "ecgNoiseStd": 0.1,               # desvio padrão do ruído gaussiano
                "ecgAmplitudePrimary": 2.0,       # amplitude do complexo QRS principal
                "ecgAmplitudeSecondary": 0.3,     # amplitude das ondas P e T
                "ecgFrequencyMultiplier": 3,      # multiplicador para ondas P/T (3x HR)
                "ecgClipRange": (-4.5, 4.5),     # range de clipping do ECG em mV
                
                # Configurações de anomalias ECG
                "lowAmplitudeValue": 0.01,        # valor para ECG de baixa amplitude
                "highVariabilityValues": [60, 120, 70, 140, 65],  # valores para alta variabilidade
                
                # Thresholds para anomalias forçadas
                "forcedBradycardiaValue": 45.0,   # BPM para bradicardia forçada
                "forcedTachycardiaValue": 150.0,  # BPM para taquicardia forçada
                
                # Configurações de precisão
                "hrDecimalPlaces": 1,             # casas decimais para HR
                "defaultEcgSamples": 1000         # número padrão de amostras ECG
            },
            "eeg": {
                # Configurações gerais
                "anomalyChance": 0.03,        # 3% chance de anomalia natural
                "stateTransitionChance": 0.05, # 5% chance de mudar estado cerebral
                "powerBandsGenChance": 0.3,   # 30% chance de gerar power bands vs raw
                
                # Parâmetros de ruído e variação
                "noiseStd": 8,                # μV - ruído gaussiano
                "channelOffsetStd": 3,        # μV - offset entre canais
                "phaseShiftIncrement": 0.1,   # incremento de fase entre canais
                "bandVariationStd": 0.05,     # 5% std variação nas power bands
                "minBandValue": 0.01,         # valor mínimo para power bands
                "bandDecimalPlaces": 3,       # casas decimais para arredondar bands
                
                # Parâmetros de artefactos
                "artifactChance": 0.02,       # 2% chance de artefactos de movimento
                "artifactSpacing": 10,        # espaçamento entre picos (samples)
                "artifactAmplitude": 150.0,   # μV - amplitude dos artefactos
                "artifactMinSamples": 20,     # mínimo samples para permitir artefactos
                "artifactDuration": 5,        # samples de duração do artefacto
                "artifactAmplitudeRange": (100, 200),  # range de amplitude dos artefactos
                
                # Valores para anomalias específicas
                "flatSignalValue": 0.1,       # μV - valor para eletrodo solto
                "dcDriftValue": 80.0,         # μV - deriva DC para anomalias
                "saturationOffset": 1.0,      # μV - offset para saturação (threshold + offset)
                
                # Amplitudes por estado cerebral
                "stateAmplitudes": {
                    "relaxed": {
                        "primary": 30,        # amplitude alfa dominante
                        "secondary": 15,      # amplitude alfa secundária
                        "frequencies": [10, 8] # Hz para alfa
                    },
                    "alert": {
                        "primary": 25,        # amplitude beta dominante
                        "secondary": 20,      # amplitude beta secundária
                        "frequencies": [18, 22] # Hz para beta
                    },
                    "drowsy": {
                        "primary": 40,        # amplitude delta dominante
                        "secondary": 25,      # amplitude delta secundária
                        "frequencies": [2, 3] # Hz para delta
                    },
                    "sleepy": {
                        "primary": 35,        # amplitude theta dominante
                        "secondary": 20,      # amplitude theta secundária
                        "frequencies": [6, 7] # Hz para theta
                    },
                    "neutral": {
                        "amplitudes": [20, 15, 10],  # alfa, beta, delta
                        "frequencies": [10, 18, 3]   # Hz correspondentes
                    }
                }
            },

            "sensors": {
                # Configurações gerais
                "anomalyChance": 0.04,              # 4% chance de anomalia natural
                "combinedAnomalyChance": 0.02,      # 2% chance de anomalia combinada
                
                # Parâmetros base de geração
                "accBaselineNoise": 5.0,            # Ruído baseline ACC em ADC units
                "gyrBaselineNoise": 2.0,            # Ruído baseline GYR em ADC units
                "accGravityOffset": {               # Offset gravitacional por eixo
                    "x": 0, "y": 0, "z": 8192      # Z = ~1g em ADC (aprox 32768/4)
                },
                "gyrZeroOffset": {                  # Offset zero por eixo
                    "x": 0, "y": 0, "z": 0
                },
                
                # Padrões de movimento normal
                "normalDriving": {
                    "accVariationStd": 10.0,        # ADC units - variação normal
                    "gyrVariationStd": 5.0,         # ADC units - variação normal
                    "corneringFrequency": 0.1,      # Hz - frequência de curvas
                    "brakingFrequency": 0.05        # Hz - frequência de travagens
                },
                
                # Valores para anomalias específicas
                "anomalyPatterns": {
                    "suddenBraking": {
                        "accMagnitude": -15000,     # ADC units (forte desaceleração)
                        "duration": 2.0,            # segundos
                        "gyrStability": 100         # ADC units (pouca rotação)
                    },
                    "aggressiveCorner": {
                        "accLateral": 8000,         # ADC units
                        "gyrYaw": 5000,             # ADC units
                        "duration": 3.0             # segundos
                    },
                    "vibrations": {
                        "accAmplitude": 2000,       # ADC units
                        "frequency": 15.0,          # Hz
                        "duration": 5.0             # segundos
                    },
                    "spin": {
                        "gyrMagnitude": 20000,      # ADC units
                        "accChaotic": 5000,         # ADC units (movimento caótico)
                        "duration": 4.0             # segundos
                    }
                },
                
                # Configurações de precisão
                "decimalPlaces": 1,                 # casas decimais para valores físicos
                "defaultSampleCount": 100           # número padrão de amostras por chunk
            }
        }

        # TODO Configurações de qualidade global ajustar quando for desenvolvido
        self.qualityConfig = {
            "cardiac": {
                "minQualityForAnomalies": 0.8,
                "minQualityForStats": 0.6,
                "warningQuality": 0.5
            },
            "eeg": {
                "minQualityForBrainState": 0.7,
                "minQualityForAnomalies": 0.8,
                "minQualityForChannelStats": 0.6
            },
            "camera": {
                "minQualityForLandmarks": 0.7,
                "minQualityForBlinks": 0.5
            },
            "unity": {
                "minQualityForAnalysis": 0.6
            }
        }

class SignalControlConfig:
    """Configurações do sistema de controlo de sinais"""
    def __init__(self):

        # Cada tópico ZeroMQ mapeia diretamente para um signal type
        self.topicToSignalTypeMapping = {
            "Polar_PPI": "hr",                    # HR/PPI do Polar
            "CardioWheel_ECG": "ecg",             # ECG do CardioWheel
            "CardioWheel_ACC": "accelerometer",   # Acelerómetro do CardioWheel
            "CardioWheel_GYR": "gyroscope",       # Giroscópio do CardioWheel
            "BrainAcess_EEG": "eegRaw"            # EEG raw do BrainAccess
        }

        # Listas derivadas do mapeamento
        self.zeroMQTopics = list(self.topicToSignalTypeMapping.keys())
        self.signalTypes = list(self.topicToSignalTypeMapping.values())

        self.componentSignalMappings = {
            # Componentes que trabalham com tópicos ZeroMQ
            "publisher": self.zeroMQTopics.copy(),   # ["Polar_PPI", "CardioWheel_ECG", "CardioWheel_ACC", "CardioWheel_GYR", "BrainAcess_EEG"]
            "listener": self.zeroMQTopics.copy(),    # ["Polar_PPI", "CardioWheel_ECG", "CardioWheel_ACC", "CardioWheel_GYR", "BrainAcess_EEG"]
            "processor": self.zeroMQTopics.copy(),   # ["Polar_PPI", "CardioWheel_ECG", "CardioWheel_ACC", "CardioWheel_GYR", "BrainAcess_EEG"] 
            
            # Componentes que trabalham com signal types
            "manager": self.signalTypes.copy(),      # ["hr", "ecg", "accelerometer", "gyroscope", "eegRaw"]
            "websocket": self.signalTypes.copy()     # ["hr", "ecg", "accelerometer", "gyroscope", "eegRaw"]
        }
        
        self.defaultActiveStates = {
            # Componentes ZeroMQ - todos os tópicos ativos
            "publisher": {topic: True for topic in self.zeroMQTopics},
            "listener": {topic: True for topic in self.zeroMQTopics},
            "processor": {topic: True for topic in self.zeroMQTopics},    
            
            # Componentes signal types - todos os signal types ativos
            "manager": {signal: True for signal in self.signalTypes},
            "websocket": {signal: False for signal in self.signalTypes} # IMPORTANTE, COMEÇAM TODOS DESATIVOS
        }
        
        # Timeouts e configurações de operação
        self.operationTimeout = 5.0                     # Segundos para operações de controlo
        self.batchOperationTimeout = 15.0               # Segundos para operações em lote
        self.stateChangeDelay = 0.1                     # Segundos entre mudanças de estado
        
        # Configurações de logging específicas
        self.logControlOperations = True                # Log de enable/disable
        self.logFilteredMessages = False                # Log de mensagens filtradas (verbose)
        self.logBatchOperations = True                  # Log de operações em lote
        
        # Validação e segurança
        self.allowEmptyActiveSignals = False            # Permitir desativar todos os sinais
        self.confirmCriticalOperations = True           # Confirmação para operações críticas
        self.maxBatchOperations = 50                    # Máximo de operações numa operação em lote
        
        # Persistência de estado
        self.persistState = True                            # Guardar estado entre reinícios
        self.stateFilePath = "signal_control_state.json"    # Ficheiro para guardar estado
        self.autoSaveInterval = 30.0                        # Segundos entre auto-saves
        
        # Componentes disponíveis para controlo
        self.availableComponents = ["publisher", "listener", "processor", "manager", "websocket"]
        
        
        # Log configuração se debug ativo
        if os.getenv('DEBUG', 'False').lower() in ('true', '1', 'yes'):
            print(f"Signal Control Config:")
            print(f"  Available components: {len(self.availableComponents)}")
            print(f"  ZeroMQ Topics: {self.zeroMQTopics}")
            print(f"  Signal Types: {self.signalTypes}")
            print(f"  Mapping: {self.topicToSignalTypeMapping}")
            print(f"  Default state: All signals active")
            print(f"  Persist state: {self.persistState}")

class Settings:
    """Configurações principais"""
    
    def __init__(self):
        # Informações básicas
        self.projectName = os.getenv('PROJECT_NAME', 'Control Room - Automotive Simulator')
        self.version = os.getenv('VERSION', '1.0.0')
        self.debugMode = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')
        self.port = int(os.getenv('PORT', 8000))

        # Modo de operação (teste ou real)
        self.useRealSensors = os.getenv('USE_REAL_SENSORS', 'False').lower() in ('true', '1', 'yes')
        
        # CORS
        cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')
        self.corsOrigins = [origin.strip() for origin in cors_origins.split(',')]
        
        # Logging
        self.logLevel = os.getenv('LOG_LEVEL', 'DEBUG')
        self.testLogLevel = os.getenv('TEST_LOG_LEVEL', 'WARNING') # TODO Acho que já esta deprecated após ultimo refacto , mas tenho que averiguar melhor
        
        # Sub-configurações
        self.zeromq = ZeroMQConfig()
        self.websocket = WebSocketConfig()
        self.signals = SignalConfig()
        self.mockZeromq = MockZeroMQConfig()
        self.signalControl = SignalControlConfig()
        
        # Carregar .env se existir
        self._loadEnvFile()
    
    def _loadEnvFile(self):
        """Carrega ficheiro .env se existir"""
        env_file = os.path.join(os.path.dirname(__file__), '../../.env')
        if os.path.exists(env_file):
            try:
                with open(env_file, 'r', encoding='utf-8') as file:
                    for line in file:
                        line = line.strip() # Remover espaços em branco
                        if line and not line.startswith('#') and '=' in line:   # Ignorar linhas vazias ou comentarios
                            key, value = line.split('=', 1)                     # Dividir conteudo da 'variavel' pelo '='
                            key = key.strip()
                            value = value.strip().strip('"').strip("'")         # Obtem a key de forma limpa
                            os.environ[key] = value                             # Agora podemos obter os.
                print(f"Loaded .env file: {env_file}")
            except Exception as e:
                print(f"Couldn't load .env file: {e}")



# Instância global
settings = Settings()

# Debug info
if settings.debugMode:
    print(f"Settings loaded: {settings.projectName} v{settings.version}")
    print(f"Debug mode: {settings.debugMode}")
    print(f"Log level: {settings.logLevel}")
    print(f"ZeroMQ Sensor port: {settings.zeromq.subscriberPort}")
    print(f"WebSocket update interval: {settings.websocket.updateInterval}s")
    #print(f"Cardiac thresholds: Bradycardia={settings.signals.cardiacConfig['hr']['bradycardiaThreshold']}, Tachycardia={settings.signals.cardiacConfig['hr']['tachycardiaThreshold']}")
    #print(f"EEG channels: {settings.signals.eegConfig['raw']['channels']}, Range: {settings.signals.eegConfig['raw']['normalRange']}")
    print(f"Mock ZeroMQ Publisher: {settings.mockZeromq.mockPublisherUrl}")
    print(f"Mock frequencies: ECG={settings.mockZeromq.topicFrequencies['CardioWheel_ECG']}Hz")



# Configurar logging específico para controlo de sinais se debug ativo
if settings.debugMode and hasattr(settings, 'signalControl'):
    signalControlLogger = logging.getLogger('signalControl')
    if settings.signalControl.logControlOperations:
        signalControlLogger.setLevel(logging.INFO)
        print(f"Signal Control logging: Enabled")
    else:
        signalControlLogger.setLevel(logging.WARNING)
        print(f"Signal Control logging: Minimal")