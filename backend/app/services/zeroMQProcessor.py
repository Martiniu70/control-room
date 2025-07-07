"""
ZeroMQProcessor - Processamento de dados recebidos via ZeroMQ

Resumo:
Processa dados brutos recebidos do ZeroMQListener e converte-os para o formato esperado
pelo SignalManager. Cada tópico ZeroMQ tem o seu próprio método de processamento específico
que lida com as particularidades dos dados (conversões, validações, formatação).

Funcionalidades principais:
- Processamento específico por tópico (Polar_PPI, CardioWheel_ECG, BrainAccess_EEG, etc.)
- Validação de dados baseada nas configurações centralizadas
- Conversão de formatos (ex: PPI para HR, chunks de dados para arrays temporais)
- Mapeamento automático de tópicos para tipos de sinais do SignalManager
- Gestão de timestamps e reconstrução de ordem temporal em chunks
- Logging detalhado para debugging no simulador
- Tratamento de exceções específicas por tipo de dados

O processor atua como adaptador entre o formato de dados ZeroMQ e a arquitetura
interna do backend, garantindo que todos os dados chegam formatados corretamente
ao SignalManager independentemente da fonte original.

FORMATO DOS DADOS ZEROMQ:
{
    "ts": "timestamp_string",
    "labels": ["label1", "label2", ...],
    "data": [[val1, val2, ...], [val1, val2, ...], ...]
}
"""

import json
import logging
import msgpack
from datetime import datetime
from typing import Dict, Any, Optional, List, Union
import numpy as np

from ..core import settings, eventManager
from ..core.exceptions import ZeroMQProcessingError, TopicValidationError, UnknownTopicError

class ZeroMQProcessor:
    """Processador de dados ZeroMQ para conversão e formatação"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Carregar configurações centralizadas
        zmqConfig = settings.zeromq
        self.topicSignalMapping = zmqConfig.topicToSignalMapping
        self.processingConfig = zmqConfig.topicProcessingConfig  
        self.validationConfig = zmqConfig.topicValidationConfig
        
        # Estatísticas de processamento por tópico
        self.processingStats = {
            "totalProcessed": 0,
            "totalErrors": 0,
            "byTopic": {topic: {
                "processed": 0,
                "errors": 0,
                "lastProcessed": None,
                "lastError": None
            } for topic in self.topicSignalMapping.keys()}
        }
        
        # Cache para timestamps e ordem de chunks
        self.chunkCache = {}
        
        self.logger.info(f"ZeroMQProcessor initialized for topics: {list(self.topicSignalMapping.keys())}")
        self.logger.debug(f"Processing config loaded: {len(self.processingConfig)} topic configs")
    
    async def processTopicData(self, topic: str, rawData: bytes) -> Optional[Dict[str, Any]]:
        """
        Processa dados de um tópico específico recebidos via ZeroMQ.
        
        Args:
            topic: Nome do tópico ZeroMQ (ex: "Polar_PPI", "CardioWheel_ECG")
            rawData: Dados brutos em bytes (msgpack ou JSON)
            
        Returns:
            Dados formatados para o SignalManager ou None se erro/inválido
            
        Raises:
            UnknownTopicError: Se tópico não é reconhecido
            ZeroMQProcessingError: Se falha no processamento dos dados
        """
        
        startTime = datetime.now()
        
        try:
            # Verificar se tópico é reconhecido
            if topic not in self.topicSignalMapping:
                availableTopics = list(self.topicSignalMapping.keys())
                raise UnknownTopicError(topic, availableTopics)
            
            self.logger.debug(f"Processing data from topic: {topic}")
            
            # Descodificar dados msgpack
            try:
                decodedData = msgpack.unpackb(rawData, raw=False)
                self.logger.debug(f"Successfully decoded msgpack data for {topic}")
            except Exception as e:
                raise ZeroMQProcessingError(
                    topic=topic,
                    operation="msgpack_decode", 
                    reason=f"Failed to decode msgpack: {e}",
                    rawData=rawData
                )

            # Validar estrutura básica dos dados
            await self._validateTopicData(topic, decodedData)
            
            # Processar dados específicos do tópico
            processedData = await self._processSpecificTopic(topic, decodedData)
            
            if processedData:
                # Atualizar estatísticas de sucesso
                self.processingStats["totalProcessed"] += 1
                self.processingStats["byTopic"][topic]["processed"] += 1
                self.processingStats["byTopic"][topic]["lastProcessed"] = datetime.now().isoformat()
                
                # Calcular tempo de processamento
                processingTime = (datetime.now() - startTime).total_seconds()
                
                self.logger.debug(f"Successfully processed {topic} data in {processingTime:.3f}s")
                
                # Emitir evento de processamento bem-sucedido
                await eventManager.emit("zmq.data_processed", {
                    "topic": topic,
                    "processingTime": processingTime,
                    "dataSize": len(rawData),
                    "outputSignalType": processedData.get("signalType"),
                    "outputDataType": processedData.get("dataType"),
                    "timestamp": datetime.now().isoformat()
                })
                
                return processedData
            else:
                raise ZeroMQProcessingError(
                    topic=topic,
                    operation="topic_processing",
                    reason="Processor returned None"
                )
        
        except (UnknownTopicError, ZeroMQProcessingError, TopicValidationError):
            # Reenviar exceções específicas tal como estão
            raise
            
        except Exception as e:
            # Capturar erros inesperados
            self._recordError(topic, str(e))
            raise ZeroMQProcessingError(
                topic=topic,
                operation="general_processing",
                reason=f"Unexpected error: {e}",
                rawData=rawData
            )
    
    async def _validateTopicData(self, topic: str, data: Any) -> None:
        """
        Valida dados recebidos baseado na configuração do tópico.
        FORMATO: {"ts": "...", "labels": [...], "data": [[...], [...]]}
        
        Args:
            topic: Nome do tópico
            data: Dados descodificados para validar
            
        Raises:
            TopicValidationError: Se dados não passam validação
        """
        
        if topic not in self.validationConfig:
            self.logger.warning(f"No validation config for topic {topic}, skipping validation")
            return
        
        config = self.validationConfig[topic]
        
        # Converter string JSON se necessário
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError as e:
                raise TopicValidationError(
                    topic=topic,
                    field="data_format",
                    value="invalid_json",
                    expectedRange=("valid_json",)
                )
        
        self.logger.debug(f"Validating data structure for {topic}: {data}")
        
        # Verificar se dados são um dicionário
        if not isinstance(data, dict):
            raise TopicValidationError(
                topic=topic,
                field="data_type",
                value=type(data).__name__,
                expectedRange=("dict",)
            )
        
        # Verificar campos obrigatórios (ts, labels, data)
        requiredFields = config.get("requiredFields", [])
        for field in requiredFields:
            if field not in data:
                raise TopicValidationError(
                    topic=topic,
                    field=field,
                    value="missing",
                    expectedRange=("required",)
                )
        
        # Validar estrutura específica do novo formato
        if "labels" in requiredFields and "data" in requiredFields:
            # Verificar se labels é uma lista
            if not isinstance(data.get("labels"), list):
                raise TopicValidationError(
                    topic=topic,
                    field="labels",
                    value=type(data.get("labels")).__name__,
                    expectedRange=("list",)
                )
            
            # Verificar se data é uma lista
            if not isinstance(data.get("data"), list):
                raise TopicValidationError(
                    topic=topic,
                    field="data",
                    value=type(data.get("data")).__name__,
                    expectedRange=("list",)
                )
            
            # Verificar se labels esperadas estão presentes
            expectedLabels = config.get("expectedLabels", [])
            actualLabels = data.get("labels", [])
            
            for expectedLabel in expectedLabels:
                if expectedLabel not in actualLabels:
                    self.logger.warning(f"Expected label '{expectedLabel}' not found in {actualLabels} for topic {topic}")
            
            # Validar dimensões dos dados
            dataArray = data.get("data", [])
            labelsArray = data.get("labels", [])
            
            if dataArray and labelsArray:
                if len(dataArray) > 0 and isinstance(dataArray[0], list):
                    # Verificar se cada linha de dados tem o mesmo número de elementos que labels
                    expectedColumns = len(labelsArray)
                    for i, row in enumerate(dataArray):
                        if len(row) != expectedColumns:
                            raise TopicValidationError(
                                topic=topic,
                                field=f"data_row_{i}",
                                value=f"length_{len(row)}",
                                expectedRange=(f"length_{expectedColumns}",)
                            )
        
        self.logger.debug(f"Data validation passed for topic {topic}")
    
    async def _processSpecificTopic(self, topic: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Redireciona para processamento específico baseado no tópico.
        
        Args:
            topic: Nome do tópico
            data: Dados validados do tópico
            
        Returns:
            Dados formatados para SignalManager
        """
        
        # Mapeamento de tópicos para métodos de processamento
        topicProcessors = {
            "Polar_PPI": self._processPolarPPI,
            "CardioWheel_ECG": self._processCardioWheelECG,
            "CardioWheel_ACC": self._processCardioWheelACC,
            "CardioWheel_GYR": self._processCardioWheelGYR,
            "BrainAcess_EEG": self._processBrainAccessEEG,
            "Control": self._processSystemControl,
            "Timestamp": self._processSystemTimestamp,
            "Cfg": self._processSystemConfig
        }
        
        self.logger.debug(f"Processing {topic} with data structure: {list(data.keys())}")
        
        processor = topicProcessors.get(topic)
        if not processor:
            raise ZeroMQProcessingError(
                topic=topic,
                operation="processor_lookup",
                reason=f"No processor found for topic {topic}"
            )
        
        return await processor(data)
    
    async def _processPolarPPI(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa dados do Polar ARM Band (PPI).
        
        FORMATO:
        {
            "ts": "timestamp",
            "labels": ["error_ms", "flags", "value"],
            "data": [[10, 0, 800], [15, 0, 820], ...]  # error_ms, flags, ppi_ms
        }
        
        Args:
            data: Dados PPI do Polar
            
        Returns:
            Dados formatados para SignalManager
        """
        
        config = self.processingConfig["Polar_PPI"]
        
        try:
            # Extrair dados principais
            timestamp = float(data["ts"])
            labels = data["labels"]
            dataArray = data["data"]
            
            self.logger.debug(f"Processing Polar PPI: labels {labels}, {len(dataArray)} data points at {timestamp}")
            
            # Mapear labels para índices
            labelMap = {label: i for i, label in enumerate(labels)}
            
            # Processar cada linha de dados (normalmente será só uma para PPI)
            processedData = []
            
            for row in dataArray:
                pointData = {}
                
                # Extrair PPI (campo "value")
                if "value" in labelMap and len(row) > labelMap["value"]:
                    ppi_ms = row[labelMap["value"]]
                    pointData["ppi"] = ppi_ms
                    
                    # Calcular HR a partir do PPI
                    if config.get("ppiToHrConversion", False) and ppi_ms > 0:
                        factor = config["ppiToHrFactor"]
                        pointData["hr"] = round(factor / ppi_ms, 1)
                        self.logger.debug(f"Converted PPI {ppi_ms}ms to HR {pointData['hr']} BPM")
                
                # Extrair campos opcionais
                if "error_ms" in labelMap and len(row) > labelMap["error_ms"]:
                    pointData["error_ms"] = row[labelMap["error_ms"]]
                
                if "flags" in labelMap and len(row) > labelMap["flags"]:
                    pointData["flags"] = row[labelMap["flags"]]
                
                processedData.append(pointData)
            
            # Mapear para formato SignalManager (usar primeiro ponto se múltiplos)
            signalMapping = self.topicSignalMapping["Polar_PPI"]
            firstPoint = processedData[0] if processedData else {}
            
            outputData = {
                "timestamp": timestamp,
                "source": "polar",
                "signalType": signalMapping["signalType"],
                "dataType": signalMapping["dataType"],
                "data": firstPoint
            }
            
            return outputData
            
        except Exception as e:
            raise ZeroMQProcessingError(
                topic="Polar_PPI",
                operation="ppi_processing",
                reason=str(e),
                rawData=data
            )
    
    async def _processCardioWheelECG(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa dados de ECG do CardioWheel.
        
        FORMATO:
        {
            "ts": "1255173.683",
            "labels": ["ECG", "LOD"], 
            "data": [[1646, 0], [1650, 0], [1651, 0], ...]
        }
        
        Args:
            data: Dados ECG do CardioWheel
            
        Returns:
            Dados formatados para SignalManager
        """
        
        config = self.processingConfig["CardioWheel_ECG"]
        
        try:
            # Extrair dados principais
            timestamp = float(data["ts"])
            labels = data["labels"]
            dataArray = data["data"]
            
            self.logger.debug(f"Processing CardioWheel ECG: {len(dataArray)} samples with labels {labels} at {timestamp}")
            
            # Encontrar índices das colunas ECG e LOD
            try:
                ecgIndex = labels.index("ECG")
                lodIndex = labels.index("LOD") if "LOD" in labels else None
            except ValueError as e:
                raise ZeroMQProcessingError(
                    topic="CardioWheel_ECG",
                    operation="label_mapping",
                    reason=f"Required label not found: {e}",
                    rawData=data
                )
            
            # Extrair valores ECG e LOD
            ecgValues = []
            lodValues = []
            
            for row in dataArray:
                if len(row) > ecgIndex:
                    ecgValues.append(row[ecgIndex])
                
                if lodIndex is not None and len(row) > lodIndex:
                    lodValues.append(row[lodIndex])
            
            self.logger.debug(f"Extracted {len(ecgValues)} ECG values, range: {min(ecgValues) if ecgValues else 'N/A'} to {max(ecgValues) if ecgValues else 'N/A'}")
            
            # Gerar timestamps para cada amostra
            timestampIncrement = config["timestampIncrement"]
            timestamps = [timestamp + (i * timestampIncrement) for i in range(len(ecgValues))]
            
            # Preparar dados de saída
            outputData = {
                "timestamp": timestamp,
                "source": "cardiowheel",
                "signalType": "cardiac",
                "dataType": "ecg",
                "data": {
                    "ecg": ecgValues,
                    "timestamps": timestamps,
                    "samplingRate": config["samplingRate"]
                }
            }
            
            # Adicionar LOD se disponível
            if lodValues:
                outputData["data"]["lod"] = lodValues
            
            return outputData
            
        except Exception as e:
            raise ZeroMQProcessingError(
                topic="CardioWheel_ECG",
                operation="ecg_processing",
                reason=str(e),
                rawData=data
            )
    
    async def _processBrainAccessEEG(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa dados EEG do BrainAccess Halo.
        
        FORMATO:
        {
            "ts": "timestamp",
            "labels": ["ch0", "ch1", "ch2", "ch3"],
            "data": [[val0, val1, val2, val3], [val0, val1, val2, val3], ...]
        }
        
        Args:
            data: Dados EEG do BrainAccess
            
        Returns:
            Dados formatados para SignalManager
        """
        
        config = self.processingConfig["BrainAcess_EEG"]
        
        try:
            timestamp = float(data["ts"])
            labels = data["labels"]
            dataArray = data["data"]
            
            self.logger.debug(f"Processing BrainAccess EEG: labels {labels}, {len(dataArray)} samples at {timestamp}")
            
            # Mapear labels para índices
            labelMap = {label: i for i, label in enumerate(labels)}
            
            # Extrair dados por canal
            eegChannelData = {}
            expectedChannels = config["channels"]  # ["ch0", "ch1", "ch2", "ch3"]
            
            for channel in expectedChannels:
                if channel in labelMap:
                    channelIndex = labelMap[channel]
                    channelValues = []
                    
                    # Extrair valores para este canal de todas as amostras
                    for row in dataArray:
                        if len(row) > channelIndex:
                            channelValues.append(row[channelIndex])
                    
                    eegChannelData[channel] = channelValues
                else:
                    self.logger.warning(f"Expected EEG channel '{channel}' not found in labels {labels}")
            
            # Verificar se temos dados de todos os canais esperados
            if len(eegChannelData) != len(expectedChannels):
                missing = set(expectedChannels) - set(eegChannelData.keys())
                self.logger.warning(f"Missing EEG channels: {missing}")
            
            self.logger.debug(f"Extracted EEG data: {len(eegChannelData)} channels, {len(dataArray)} samples each")
            
            signalMapping = self.topicSignalMapping["BrainAcess_EEG"]
            
            return {
                "timestamp": timestamp,
                "source": "halo",
                "signalType": signalMapping["signalType"],
                "dataType": signalMapping["dataType"],
                "data": {
                    "eegRaw": eegChannelData,
                    "samplingRate": config["samplingRate"]
                }
            }
            
        except Exception as e:
            raise ZeroMQProcessingError(
                topic="BrainAcess_EEG",
                operation="eeg_processing",
                reason=str(e),
                rawData=data
            )
    
    async def _processCardioWheelACC(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa dados do acelerómetro do CardioWheel.
        
        FORMATO:
        {
            "ts": "timestamp",
            "labels": ["X", "Y", "Z"],
            "data": [[x_val, y_val, z_val], [x_val, y_val, z_val], ...]
        }
        
        Args:
            data: Dados do acelerómetro
            
        Returns:
            Dados formatados para SignalManager
        """
        
        config = self.processingConfig["CardioWheel_ACC"]
        
        try:
            timestamp = float(data["ts"])
            labels = data["labels"]
            dataArray = data["data"]
            
            self.logger.debug(f"Processing CardioWheel ACC: labels {labels}, {len(dataArray)} samples at {timestamp}")
            
            # Mapear labels para índices
            labelMap = {label: i for i, label in enumerate(labels)}
            expectedAxes = config["axes"]  # ["X", "Y", "Z"]
            
            # Extrair dados por eixo
            accelerometerData = {}
            
            for axis in expectedAxes:
                if axis in labelMap:
                    axisIndex = labelMap[axis]
                    axisValues = []
                    
                    # Extrair valores para este eixo de todas as amostras
                    for row in dataArray:
                        if len(row) > axisIndex:
                            axisValues.append(row[axisIndex])
                    
                    accelerometerData[axis.lower()] = axisValues
                else:
                    self.logger.warning(f"Expected accelerometer axis '{axis}' not found in labels {labels}")
            
            self.logger.debug(f"Extracted accelerometer data: {len(accelerometerData)} axes, {len(dataArray)} samples each")
            
            signalMapping = self.topicSignalMapping["CardioWheel_ACC"]
            
            return {
                "timestamp": timestamp,
                "source": "cardiowheel",
                "signalType": signalMapping["signalType"],
                "dataType": signalMapping["dataType"],
                "data": {
                    "accelerometer": accelerometerData,
                    "samplingRate": config["samplingRate"]
                }
            }
            
        except Exception as e:
            raise ZeroMQProcessingError(
                topic="CardioWheel_ACC",
                operation="accelerometer_processing",
                reason=str(e),
                rawData=data
            )
    
    async def _processCardioWheelGYR(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa dados do giroscópio do CardioWheel.
        
        FORMATO:
        {
            "ts": "timestamp",
            "labels": ["X", "Y", "Z"],
            "data": [[x_val, y_val, z_val], [x_val, y_val, z_val], ...]
        }
        
        Args:
            data: Dados do giroscópio
            
        Returns:
            Dados formatados para SignalManager
        """
        
        config = self.processingConfig["CardioWheel_GYR"]
        
        try:
            timestamp = float(data["ts"])
            labels = data["labels"]
            dataArray = data["data"]
            
            self.logger.debug(f"Processing CardioWheel GYR: labels {labels}, {len(dataArray)} samples at {timestamp}")
            
            # Mapear labels para índices
            labelMap = {label: i for i, label in enumerate(labels)}
            expectedAxes = config["axes"]  # ["X", "Y", "Z"]
            
            # Extrair dados por eixo
            gyroscopeData = {}
            
            for axis in expectedAxes:
                if axis in labelMap:
                    axisIndex = labelMap[axis]
                    axisValues = []
                    
                    # Extrair valores para este eixo de todas as amostras
                    for row in dataArray:
                        if len(row) > axisIndex:
                            axisValues.append(row[axisIndex])
                    
                    gyroscopeData[axis.lower()] = axisValues
                else:
                    self.logger.warning(f"Expected gyroscope axis '{axis}' not found in labels {labels}")
            
            self.logger.debug(f"Extracted gyroscope data: {len(gyroscopeData)} axes, {len(dataArray)} samples each")
            
            signalMapping = self.topicSignalMapping["CardioWheel_GYR"]
            
            return {
                "timestamp": timestamp,
                "source": "cardiowheel",
                "signalType": signalMapping["signalType"],
                "dataType": signalMapping["dataType"],
                "data": {
                    "gyroscope": gyroscopeData,
                    "samplingRate": config["samplingRate"]
                }
            }
            
        except Exception as e:
            raise ZeroMQProcessingError(
                topic="CardioWheel_GYR",
                operation="gyroscope_processing",
                reason=str(e),
                rawData=data
            )
    
    async def _processSystemControl(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa mensagens de controlo do sistema.
        
        Args:
            data: Dados de controlo
            
        Returns:
            Dados formatados para SignalManager
        """
        
        try:
            signalMapping = self.topicSignalMapping["Control"]
            
            self.logger.debug(f"Processing system control: {data}")
            
            return {
                "timestamp": datetime.now().timestamp(),
                "source": "system",
                "signalType": signalMapping["signalType"],
                "dataType": signalMapping["dataType"],
                "data": {
                    "control": data
                }
            }
            
        except Exception as e:
            raise ZeroMQProcessingError(
                topic="Control",
                operation="control_processing",
                reason=str(e),
                rawData=data
            )
    
    async def _processSystemTimestamp(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa mensagens de timestamp do sistema.
        
        Args:
            data: Dados de timestamp
            
        Returns:
            Dados formatados para SignalManager
        """
        
        try:
            signalMapping = self.topicSignalMapping["Timestamp"]
            
            self.logger.debug(f"Processing system timestamp: {data}")
            
            return {
                "timestamp": datetime.now().timestamp(),
                "source": "system",
                "signalType": signalMapping["signalType"],
                "dataType": signalMapping["dataType"],
                "data": {
                    "timestamp": data
                }
            }
            
        except Exception as e:
            raise ZeroMQProcessingError(
                topic="Timestamp",
                operation="timestamp_processing",
                reason=str(e),
                rawData=data
            )
    
    async def _processSystemConfig(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processa mensagens de configuração do sistema.
        
        Args:
            data: Dados de configuração
            
        Returns:
            Dados formatados para SignalManager
        """
        
        try:
            signalMapping = self.topicSignalMapping["Cfg"]
            
            self.logger.debug(f"Processing system config: {data}")
            
            return {
                "timestamp": datetime.now().timestamp(),
                "source": "system",
                "signalType": signalMapping["signalType"],
                "dataType": signalMapping["dataType"],
                "data": {
                    "config": data
                }
            }
            
        except Exception as e:
            raise ZeroMQProcessingError(
                topic="Cfg",
                operation="config_processing",
                reason=str(e),
                rawData=data
            )
    
    def _recordError(self, topic: str, error: str) -> None:
        """
        Regista erro nas estatísticas para debugging.
        
        Args:
            topic: Tópico onde ocorreu o erro
            error: Descrição do erro
        """
        
        self.processingStats["totalErrors"] += 1
        
        if topic in self.processingStats["byTopic"]:
            self.processingStats["byTopic"][topic]["errors"] += 1
            self.processingStats["byTopic"][topic]["lastError"] = {
                "error": error,
                "timestamp": datetime.now().isoformat()
            }
        
        self.logger.error(f"Recorded processing error for {topic}: {error}")
    
    def getProcessingStats(self) -> Dict[str, Any]:
        """
        Retorna estatísticas de processamento para monitoring.
        
        Returns:
            Estatísticas detalhadas por tópico
        """
        
        return {
            "totalProcessed": self.processingStats["totalProcessed"],
            "totalErrors": self.processingStats["totalErrors"],
            "successRate": (
                self.processingStats["totalProcessed"] / 
                max(1, self.processingStats["totalProcessed"] + self.processingStats["totalErrors"])
            ),
            "byTopic": self.processingStats["byTopic"].copy(),
            "supportedTopics": list(self.topicSignalMapping.keys()),
            "lastUpdate": datetime.now().isoformat()
        }
    
    def reset(self) -> None:
        """
        Reset das estatísticas de processamento.
        """
        
        self.processingStats = {
            "totalProcessed": 0,
            "totalErrors": 0,
            "byTopic": {topic: {
                "processed": 0,
                "errors": 0,
                "lastProcessed": None,
                "lastError": None
            } for topic in self.topicSignalMapping.keys()}
        }
        
        self.chunkCache.clear()
        
        self.logger.info("ZeroMQProcessor statistics reset")

# Instância global
zeroMQProcessor = ZeroMQProcessor()