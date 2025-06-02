"""
Mock data generator para sinais EEG (Halo BrainAccess) - VERSÃO FINAL

Resumo:
Gerador de dados EEG simulados para o dispositivo Halo BrainAccess, completamente configurável 
através do ficheiro de configurações centralizado. Simula de forma realista os sinais cerebrais 
de 4 canais de EEG a 250Hz e power bands (delta, theta, alpha, beta, gamma) que representam 
diferentes estados mentais como relaxado, alerta, sonolento ou neutro.

Funcionalidades principais:
- Geração de segmentos EEG raw com ruído fisiológico e correlação espacial entre canais
- Simulação de power bands baseada em templates de estados cerebrais conhecidos
- Injeção controlada de artefactos (movimento, eletrodo solto, saturação, deriva DC)
- Detecção automática de anomalias através de thresholds configuráveis
- Transições naturais entre estados cerebrais durante a simulação
- Integração completa com o sistema de configurações centralizado

O gerador elimina completamente números mágicos (magic numbers) e permite ajustar todos
os parâmetros através das configurações, desde amplitudes e frequências por estado cerebral
até probabilidades de anomalias e características do ruído.
"""

import numpy as np
from typing import Dict, Any, List, Optional
from .baseMock import BaseMockGenerator
from app.core import settings


class EEGMockGenerator(BaseMockGenerator):
    """Gerador de dados mock para sinais EEG do Halo BrainAccess"""
    
    def __init__(self):
        super().__init__("EEG")
        
        # Carregar configurações EEG e estados cerebrais
        self.eegConfig = settings.signals.eegConfig
        self.brainStatesConfig = self.eegConfig["brainStates"]

        # Configurar estados cerebrais disponíveis
        self.brainStates = self.brainStatesConfig["availableStates"]
        self.currentState = self.brainStatesConfig["defaultState"]
        self.stateBandTemplates = self.brainStatesConfig["stateBandTemplates"]

        # Parâmetros base de aquisição
        self.samplingRate = self.eegConfig["raw"]["samplingRate"]          # 250Hz
        self.channelNames = self.eegConfig["raw"]["channelNames"]          # ["ch1", "ch2", "ch3", "ch4"]
        
        # Probabilidades de eventos
        self.anomalyChance = self.mockConfig["eeg"]["anomalyChance"]                   # 3% chance de anomalia natural
        self.stateTransitionChance = self.mockConfig["eeg"]["stateTransitionChance"]   # 5% chance de mudar estado
    
    def generateEegRawSegment(self, duration: float = 1.0) -> Dict[str, List[float]]:
        """
        Gera um segmento de EEG raw para os 4 canais cerebrais.
        
        Simula actividade cerebral realista baseada no estado mental actual,
        incluindo ruído fisiológico, correlação espacial entre canais e 
        possíveis artefactos de movimento.
        
        Args:
            duration: Duração do segmento em segundos
            
        Returns:
            Dicionário com dados dos 4 canais: {"ch1": [samples], "ch2": [samples], ...}
        """
        # Calcular número de amostras para a duração especificada
        samples = int(duration * self.samplingRate)
        t = np.linspace(0, duration, samples)
        
        channels = {}
        mockEegConfig = self.mockConfig["eeg"]
        stateAmplitudes = mockEegConfig["stateAmplitudes"]
        
        # Gerar sinal para cada canal
        for i, channel in enumerate(self.channelNames):
            eeg = np.zeros(samples)
            
            # Aplicar componentes de frequência baseadas no estado cerebral actual
            if self.currentState in ["relaxed", "alert", "drowsy", "sleepy"]:
                # Estados específicos têm duas componentes principais
                stateConfig = stateAmplitudes[self.currentState]
                primary_amp = stateConfig["primary"]        # Amplitude da frequência dominante
                secondary_amp = stateConfig["secondary"]    # Amplitude da frequência secundária
                freqs = stateConfig["frequencies"]          # Lista de frequências [dominante, secundária]
                
                # Componente dominante (ex: alfa para relaxed, beta para alert)
                eeg += primary_amp * np.sin(2 * np.pi * freqs[0] * t)
                # Componente secundária para tentar ser mais realista
                eeg += secondary_amp * np.sin(2 * np.pi * freqs[1] * t)
                
            else:  # Estado neutro - mistura equilibrada
                neutralConfig = stateAmplitudes["neutral"]
                amplitudes = neutralConfig["amplitudes"]    # [alfa, beta, delta]
                frequencies = neutralConfig["frequencies"]  # [10Hz, 18Hz, 3Hz]
                
                # Adicionar cada componente de frequência
                for amp, freq in zip(amplitudes, frequencies):
                    eeg += amp * np.sin(2 * np.pi * freq * t)
            
            # Adicionar ruído fisiológico gaussiano (simula actividade neuronal de fundo)
            noise = np.random.normal(0, mockEegConfig["noiseStd"], samples)
            eeg += noise
            
            # Simular diferenças entre canais (correlação espacial do cérebro)
            channelOffset = np.random.normal(0, mockEegConfig["channelOffsetStd"])  # Baseline único por canal
            phaseShift = i * mockEegConfig["phaseShiftIncrement"]                   # Desvio de fase entre canais
            eeg += channelOffset
            eeg *= (1 + phaseShift)  # Aplicar ligeiro ganho diferencial
            
            # Simular artefactos ocasionais (movimento, piscar de olhos, etc.)
            if (np.random.random() < mockEegConfig["artifactChance"] and 
                samples > mockEegConfig["artifactMinSamples"]):
                
                # Posição aleatória para o artefacto, evitando bordas
                spikePosition = np.random.randint(10, samples-10)
                artifactRange = mockEegConfig["artifactAmplitudeRange"]    # (100, 200) microvolts
                artifactDuration = mockEegConfig["artifactDuration"]       # 5 samples
                
                # Amplitude aleatória dentro do range configurado
                artifactAmplitude = np.random.uniform(artifactRange[0], artifactRange[1])
                endPos = min(spikePosition + artifactDuration, samples)
                eeg[spikePosition:endPos] += artifactAmplitude
            
            # Limitar amplitude ao range fisiológico normal
            eegRange = self.eegConfig["raw"]["normalRange"]                # (-200, 200) microvolts
            eeg = np.clip(eeg, eegRange[0], eegRange[1])
            
            # Converter para lista e armazenar
            channels[channel] = eeg.tolist()
        
        return channels
    
    def generatePowerBands(self) -> Dict[str, float]:
        """
        Gera power bands (distribuição de energia por frequência) baseada no estado cerebral actual.
        
        As power bands representam a percentagem de energia em cada banda de frequência:
        - Delta (1-4Hz): Sono profundo
        - Theta (4-8Hz): Sonolência, meditação
        - Alpha (8-12Hz): Relaxamento, olhos fechados
        - Beta (13-30Hz): Concentração, estado alerta
        - Gamma (30-100Hz): Processamento cognitivo complexo
        
        Returns:
            Dicionário com percentagens: {"delta": 0.15, "theta": 0.20, ...}
        """
        # Copiar template do estado actual para evitar modificar o original
        template = self.stateBandTemplates[self.currentState].copy()
        mockEegConfig = self.mockConfig["eeg"]
        
        # Adicionar variação natural para simular flutuações fisiológicas
        for band in template:
            # Variação gaussiana com desvio padrão configurável
            variation = np.random.normal(0, mockEegConfig["bandVariationStd"])
            # Garantir que o valor não fica negativo
            template[band] = max(mockEegConfig["minBandValue"], template[band] + variation)
        
        # Normalizar para garantir que a soma é aproximadamente 1.0
        total = sum(template.values())
        for band in template:
            template[band] /= total
        
        # Arredondar para o número de casas decimais configurado
        decimalPlaces = mockEegConfig["bandDecimalPlaces"]
        for band in template:
            template[band] = round(template[band], decimalPlaces)
        
        return template
    
    def generateMockData(self) -> Dict[str, Any]:
        """
        Gera dados mock EEG completos, alternando entre EEG raw e power bands,
        usado só pelos testes para fazer um ministream de fake data.
        
        Returns:
            Dicionário com dados EEG raw ou power bands
        """
        # Actualizar estado cerebral se necessário
        self.updateBrainState()
        
        # Decidir tipo de dados a gerar baseado na probabilidade configurada
        powerBandsChance = self.mockConfig["eeg"]["powerBandsGenChance"]
        if np.random.random() < powerBandsChance:
            # Gerar power bands 
            return {
                "eegBands": self.generatePowerBands()
            }
        else:
            # Gerar EEG raw (mais frequente com currnet configs)
            return {
                "eegRaw": self.generateEegRawSegment(duration=0.004)  # 4ms de dados
            }
    
    def generateAnomalyData(self, anomalyType: str) -> Dict[str, Any]:
        """
        Gera dados EEG com anomalias específicas para teste do sistema de deteção.
        
        Permite testar como é que o sistema responde a problemas técnicos ou condições
        médicas específicas. Todas as anomalias usam valores configuráveis no config.py.
        
        Args:
            anomalyType: Tipo de anomalia a simular
            
        Returns:
            Dados EEG com a anomalia especificada
        """
        mockEegConfig = self.mockConfig["eeg"]
        
        if anomalyType == "electrode_loose":
            # Eletrodo solto - sinal muito plano com pouca variação
            channels = self.generateEegRawSegment()
            flatValue = mockEegConfig["flatSignalValue"]
            channels["ch2"] = [flatValue] * len(channels["ch2"])
            return {"eegRaw": channels}
        
        elif anomalyType == "saturation":
            # Saturação do amplificador - sinal constante no máximo
            channels = self.generateEegRawSegment()
            saturationValue = (self.eegConfig["raw"]["saturationThreshold"] + 
                             mockEegConfig["saturationOffset"])
            channels["ch1"] = [saturationValue] * len(channels["ch1"])
            return {"eegRaw": channels}
        
        elif anomalyType == "movement_artifact":
            # Artefacto de movimento - picos periódicos de alta amplitude
            channels = self.generateEegRawSegment()
            artifactSpacing = mockEegConfig["artifactSpacing"]      # Espaçamento entre picos
            artifactAmplitude = mockEegConfig["artifactAmplitude"]  # Amplitude dos picos
            
            # Aplicar picos em canais múltiplos para simular movimento da cabeça
            for ch in ["ch1", "ch3"]:
                for i in range(len(channels[ch])):
                    if i % artifactSpacing == 0:
                        channels[ch][i] += artifactAmplitude
            return {"eegRaw": channels}
        
        elif anomalyType == "dc_drift":
            # Deriva DC - mudança gradual da linha de base
            channels = self.generateEegRawSegment()
            driftValue = mockEegConfig["dcDriftValue"]
            # Adicionar offset constante a um canal
            channels["ch4"] = [x + driftValue for x in channels["ch4"]]
            return {"eegRaw": channels}
        
        elif anomalyType == "delta_dominance":
            # Dominância excessiva de ondas delta (possível sonolência extrema)
            deltaThreshold = self.eegConfig["bands"]["deltaExcessThreshold"]
            return {
                "eegBands": {
                    "delta": deltaThreshold + 0.10,  # 10% acima do threshold crítico
                    "theta": 0.10,
                    "alpha": 0.05,
                    "beta": 0.03,
                    "gamma": 0.02
                }
            }
        
        elif anomalyType == "beta_excess":
            # Beta excessivo (possível ansiedade ou stress elevado)
            betaThreshold = self.eegConfig["bands"]["betaExcessThreshold"]
            return {
                "eegBands": {
                    "delta": 0.05,
                    "theta": 0.10,
                    "alpha": 0.15,
                    "beta": betaThreshold + 0.05,  # 5% acima do threshold
                    "gamma": 0.05
                }
            }
        
        elif anomalyType == "alpha_absence":
            # Ausência de ondas alfa (possível stress ou tensão mental)
            alphaDeficit = self.eegConfig["bands"]["alphaDeficitThreshold"]
            return {
                "eegBands": {
                    "delta": 0.30,
                    "theta": 0.25,
                    "alpha": alphaDeficit - 0.01,  # Ligeiramente abaixo do threshold
                    "beta": 0.35,
                    "gamma": 0.08
                }
            }
        
        elif anomalyType == "power_sum_error":
            # Erro de calibração - power bands não somam 1.0
            return {
                "eegBands": {
                    "delta": 0.10,
                    "theta": 0.15,
                    "alpha": 0.20,
                    "beta": 0.25,
                    "gamma": 0.10  # Soma total = 0.80 (fora da tolerância)
                }
            }
        
        else:
            # Tipo de anomalia não reconhecido - retornar dados normais
            return self.generateMockData()
    
    def updateBrainState(self):
        """
        Atualiza o estado cerebral actual baseado na probabilidade de transição.
        
        Simula mudanças naturais no estado mental durante períodos prolongados,
        como transição de alerta para sonolento ou de relaxado para neutro.
        """
        if np.random.random() < self.stateTransitionChance:
            # Escolher novo estado aleatoriamente
            newState = np.random.choice(self.brainStates)
            if newState != self.currentState:
                self.currentState = newState
                self.logger.info(f"Brain state changed to: {newState}")
    
    def generateStreamData(self, durationSeconds: float = 3.0) -> List[Dict[str, Any]]:
        """
        Gera stream contínuo de dados EEG para um período especificado.
        
        Intercala dados EEG raw e power bands nas frequências configuradas
        para simular o comportamento real do dispositivo Halo BrainAccess.
        
        Args:
            durationSeconds: Duração total do stream em segundos
            
        Returns:
            Lista de mensagens ZeroMQ com dados EEG
        """
        messages = []
        
        # Obter frequências de streaming configuradas
        eegRawFreq = settings.signals.streamingConfig["eegRawFrequency"]     # 25Hz
        eegBandsFreq = settings.signals.streamingConfig["eegBandsFrequency"] # 5Hz
        
        # Calcular número de mensagens necessárias
        rawSamples = int(durationSeconds * eegRawFreq)
        bandSamples = int(durationSeconds * eegBandsFreq)
        bandsSpacing = int(eegRawFreq / eegBandsFreq)  # A cada quantos raw enviar bands
        
        # Gerar stream intercalado
        for i in range(max(rawSamples, bandSamples)):
            # Enviar power bands na frequência configurada
            if i < bandSamples and i % bandsSpacing == 0:
                message = self.generateZeroMQMessage()
                message["data"] = {"eegBands": self.generatePowerBands()}
                messages.append(message)
            
            # Enviar EEG raw na frequência configurada
            if i < rawSamples:
                message = self.generateZeroMQMessage()
                message["data"] = {"eegRaw": self.generateEegRawSegment(duration=0.004)}
                messages.append(message)
        
        self.logger.info(f"Generated {len(messages)} EEG messages for {durationSeconds}s stream")
        return messages

    def simulateBrainStateSequence(self, states: List[str], secondsPerState: float = 2.0) -> List[Dict[str, Any]]:
        """
        Simula uma sequência específica de estados cerebrais.
        
        Útil para testar respostas do sistema a mudanças conhecidas no estado mental,
        como progressão de alerta para sonolento ou demonstrações controladas.
        
        Args:
            states: Lista de estados a simular sequencialmente
            secondsPerState: Duração de cada estado em segundos
            
        Returns:
            Lista completa de mensagens para toda a sequência
        """
        messages = []
        
        for state in states:
            # Forçar estado específico
            self.currentState = state
            self.logger.info(f"Simulating brain state: {state}")
            
            # Gerar dados para este estado durante o período especificado
            stateMessages = self.generateStreamData(secondsPerState)
            messages.extend(stateMessages)
        
        return messages
    
    def getBrainStateInfo(self) -> Dict[str, Any]:
        """
        Retorna informação completa sobre o estado cerebral actual.
        
        Inclui estado actual, estados disponíveis, power bands esperadas
        e configurações de amplitude para o estado activo.
        
        Returns:
            Dicionário com informação detalhada do estado cerebral
        """
        return {
            "currentState": self.currentState,
            "availableStates": self.brainStates,
            "expectedBands": self.stateBandTemplates[self.currentState],
            "stateDescription": self._getStateDescription(self.currentState),
            "stateAmplitudes": self.mockConfig["eeg"]["stateAmplitudes"][self.currentState]
        }
    
    def _getStateDescription(self, state: str) -> str:
        """
        Fornece descrição textual detalhada de um estado cerebral.
        
        Args:
            state: Nome do estado cerebral
            
        Returns:
            Descrição do estado e características
        """
        descriptions = {
            "relaxed": "Estado relaxado - dominância de ondas alfa",
            "alert": "Estado alerta - dominância de ondas beta",
            "drowsy": "Estado muito sonolento - dominância de ondas delta",
            "sleepy": "Estado sonolento - dominância de ondas theta",
            "neutral": "Estado neutro - mistura equilibrada de frequências"
        }
        return descriptions.get(state, "Estado desconhecido")