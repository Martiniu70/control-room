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
            "CardioWheel_ACC": "WARNING", # Só avisos para acelerómetro
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
                "expectedFrequency": 0.05,          # Configurações raras - TODO averiguar utilidade
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

class Settings:
    """Configurações principais"""
    
    def __init__(self):
        # Informações básicas
        self.projectName = os.getenv('PROJECT_NAME', 'Control Room - Automotive Simulator')
        self.version = os.getenv('VERSION', '1.0.0')
        self.debugMode = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')
        self.port = int(os.getenv('PORT', 8000))

        # Modo de operação (teste ou real)
        self.useRealSensors = os.getenv('USE_REAL_SENSORS', 'True').lower() in ('true', '1', 'yes')
        
        # CORS
        cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')
        self.corsOrigins = [origin.strip() for origin in cors_origins.split(',')]
        
        # Logging
        self.logLevel = os.getenv('LOG_LEVEL', 'DEBUG')
        self.testLogLevel = os.getenv('TEST_LOG_LEVEL', 'WARNING')
        
        # Sub-configurações
        self.zeromq = ZeroMQConfig()
        self.websocket = WebSocketConfig()
        self.signals = SignalConfig()
        
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
    print(f"Cardiac thresholds: Bradycardia={settings.signals.cardiacConfig['hr']['bradycardiaThreshold']}, Tachycardia={settings.signals.cardiacConfig['hr']['tachycardiaThreshold']}")
    print(f"EEG channels: {settings.signals.eegConfig['raw']['channels']}, Range: {settings.signals.eegConfig['raw']['normalRange']}")