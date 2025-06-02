"""
Mock data generator para sinais cardíacos (CardioWheel e Polar)

Resumo:
Gerar dados cardíacos simulados para dispositivos como CardioWheel e Polar Armband. Simula de forma
semi-realista os sinais de electrocardiograma (ECG) e eventos de frequência cardíaca (HR).

Funcionalidades principais:
- Geração de segmentos ECG com ondas P, QRS e T simuladas de forma simplificada
- Simulação de eventos HR com variação natural e possíveis anomalias
- Detecção e simulação de bradicardia (batimento lento) e taquicardia (batimento rápido)
- Simulação controlada de anomalias como baixa amplitude ECG e alta variabilidade HR
"""

import numpy as np
from typing import Dict, Any, List
from .baseMock import BaseMockGenerator
from app.core import settings

class CardiacMockGenerator(BaseMockGenerator):
    """Gerador de dados mock para sinais cardíacos"""
    
    def __init__(self):
        super().__init__("Cardiac")
        
        # Carregar configurações cardíacas
        cardiacConfig = settings.signals.cardiacConfig
        mockCardiacConfig = self.mockConfig["cardiac"]
        
        # Parâmetros base de simulação
        self.baseHr = mockCardiacConfig["baseHr"]                                   # 75 BPM como valor base
        self.anomalyChance = mockCardiacConfig["anomalyChance"]                     # 5% probabilidade de anomalia
        self.hrVariationStd = mockCardiacConfig["hrVariationStd"]                   # ±5 BPM variação natural
        
        # Ranges fisiológicos e thresholds
        self.normalRange = cardiacConfig["hr"]["normalRange"]                       # (60, 100) BPM normal
        self.criticalRange = cardiacConfig["hr"]["criticalRange"]                   # (30, 200) BPM crítico
        self.bradycardiaThreshold = cardiacConfig["hr"]["bradycardiaThreshold"]     # 60 BPM
        self.tachycardiaThreshold = cardiacConfig["hr"]["tachycardiaThreshold"]     # 100 BPM
        
        # Configurações ECG
        self.ecgNoiseStd = mockCardiacConfig["ecgNoiseStd"]                         # 0.1 mV ruído
        self.ecgAmplitudePrimary = mockCardiacConfig["ecgAmplitudePrimary"]         # 2.0 mV complexo QRS
        self.ecgAmplitudeSecondary = mockCardiacConfig["ecgAmplitudeSecondary"]     # 0.3 mV ondas P/T
        self.ecgFrequencyMultiplier = mockCardiacConfig["ecgFrequencyMultiplier"]   # 3x para P/T
        self.ecgClipRange = mockCardiacConfig["ecgClipRange"]                       # (-4.5, 4.5) mV
        
        # Valores para anomalias específicas
        self.lowAmplitudeValue = mockCardiacConfig["lowAmplitudeValue"]             # 0.01 mV amplitude baixa
        self.highVariabilityValues = mockCardiacConfig["highVariabilityValues"]     # Lista de valores variáveis
        self.forcedBradycardiaValue = mockCardiacConfig["forcedBradycardiaValue"]   # 45 BPM forçado
        self.forcedTachycardiaValue = mockCardiacConfig["forcedTachycardiaValue"]   # 150 BPM forçado
        
        # Configurações de precisão
        self.hrDecimalPlaces = mockCardiacConfig["hrDecimalPlaces"]                 # 1 casa decimal
        self.defaultEcgSamples = mockCardiacConfig["defaultEcgSamples"]             # 1000 amostras padrão
    
    def generateEcgSegment(self, duration: float = 1.0, samplingRate: int = 1000) -> List[float]:
        """
        Gera segmento de ECG simulado com características fisiológicas básicas.
        
        Cria um sinal de electrocardiograma simplificado que inclui:
        - Complexo QRS principal (despolarização ventricular)
        - Ondas P e T secundárias (despolarização atrial e repolarização)
        - Ruído gaussiano para simular interferências naturais
        - Limitação ao range fisiológico normal
        
        Args:
            duration: Duração do segmento em segundos
            samplingRate: Frequência de amostragem em Hz
            
        Returns:
            Lista de valores ECG em milivolts
        """
        # Calcular parâmetros temporais
        samples = int(duration * samplingRate)
        t = np.linspace(0, duration, samples)
        
        # Converter HR base para frequência cardíaca em Hz
        heartRateHz = self.baseHr / 60.0
        
        # Gerar componente principal - complexo QRS (despolarização ventricular)
        # Usar função sinusoidal como aproximação básica das ondas cardíacas
        ecg = self.ecgAmplitudePrimary * np.sin(2 * np.pi * heartRateHz * t)
        
        # Adicionar componentes secundárias - ondas P e T (actividade atrial)
        # Frequência mais alta para simular as ondas mais rápidas P/T
        secondaryFreq = heartRateHz * self.ecgFrequencyMultiplier
        ecg += self.ecgAmplitudeSecondary * np.sin(2 * np.pi * secondaryFreq * t)
        
        # Adicionar ruído branco gaussiano para realismo
        # Simula interferências eléctricas naturais e ruído do amplificador
        noise = np.random.normal(0, self.ecgNoiseStd, samples)
        ecg += noise
        
        # Limitar ao range fisiológico configurado para evitar valores irrealistas
        ecg = np.clip(ecg, self.ecgClipRange[0], self.ecgClipRange[1])
        
        return ecg.tolist()
    
    def generateHrEvent(self) -> float:
        """
        Gera evento de frequência cardíaca com variação natural e possíveis anomalias.
        
        Simula um batimento cardíaco individual considerando:
        - Variação natural da frequência cardíaca
        - Possibilidade de anomalias (bradicardia/taquicardia)
        - Limitação aos ranges fisiológicos configurados
        
        Returns:
            Valor de HR em batimentos por minuto (BPM)
        """
        # Aplicar variação natural gaussiana ao HR base
        variation = np.random.normal(0, self.hrVariationStd)
        hr = self.baseHr + variation
        
        # Manter dentro do range normal inicialmente
        hr = max(self.normalRange[0], min(self.normalRange[1], hr))
        
        # Simular anomalias ocasionais baseado na probabilidade configurada
        if np.random.random() < self.anomalyChance:
            # Escolher tipo de anomalia aleatoriamente
            anomalyType = np.random.choice(["bradycardia", "tachycardia"])
            
            if anomalyType == "bradycardia":
                # Bradicardia - HR abaixo do threshold, dentro do range crítico
                hr = np.random.uniform(self.criticalRange[0], self.bradycardiaThreshold)
            else:
                # Taquicardia - HR acima do threshold, dentro do range crítico
                hr = np.random.uniform(self.tachycardiaThreshold, self.criticalRange[1])
            
            # Registar anomalia para debug
            self.logger.warning(f"Simulating {anomalyType}: {hr:.1f} bpm")
        
        # Arredondar conforme configuração de precisão
        return round(hr, self.hrDecimalPlaces)
    
    def generateMockData(self) -> Dict[str, Any]:
        """
        Gera dados mock cardíacos completos incluindo ECG e HR.
        
        Método principal que combina geração de ECG e eventos HR para
        simular dados completos de um dispositivo cardíaco real.
        
        Returns:
            Dicionário com dados ECG e HR: {"ecg": [samples], "hr": bpm_value}
        """
        return {
            "ecg": self.generateEcgSegment(duration=1.0),
            "hr": self.generateHrEvent()
        }
    
    def generateAnomalyData(self, anomalyType: str) -> Dict[str, Any]:
        """
        Gera dados cardíacos com anomalias específicas para teste do sistema.
        
        Permite forçar condições específicas para testar a resposta do sistema
        de detecção de anomalias a diferentes tipos de problemas cardíacos.
        
        Args:
            anomalyType: Tipo específico de anomalia a simular
            
        Returns:
            Dados cardíacos com a anomalia especificada
        """
        # Começar com dados normais como base
        data = self.generateMockData()
        
        if anomalyType == "bradycardia":
            # Bradicardia severa - HR fixo abaixo do threshold
            data["hr"] = self.forcedBradycardiaValue
            
        elif anomalyType == "tachycardia":
            # Taquicardia severa - HR fixo acima do threshold
            data["hr"] = self.forcedTachycardiaValue
            
        elif anomalyType == "low_amplitude_ecg":
            # ECG com amplitude muito baixa - possível eletrodo solto
            # Substituir por sinal quase plano com número configurado de amostras
            data["ecg"] = [self.lowAmplitudeValue] * self.defaultEcgSamples
            
        elif anomalyType == "high_variability":
            # HR com variabilidade extrema - escolher valor aleatório da lista
            # Simula arritmias ou interferências no sensor
            data["hr"] = np.random.choice(self.highVariabilityValues)
            
        elif anomalyType == "ecg_saturation":
            # ECG saturado no máximo - problema do amplificador
            ecgRange = settings.signals.cardiacConfig["ecg"]["normalEcgRange"]
            maxValue = ecgRange[1]  # Usar máximo do range configurado
            data["ecg"] = [maxValue] * self.defaultEcgSamples
            
        elif anomalyType == "ecg_drift":
            # ECG com deriva da linha de base
            normalEcg = self.generateEcgSegment(duration=1.0)
            driftValue = settings.signals.cardiacConfig["ecg"]["driftThreshold"]
            data["ecg"] = [sample + driftValue for sample in normalEcg]
            
        elif anomalyType == "hr_out_of_range":
            # HR completamente fora do range crítico
            data["hr"] = np.random.choice([25.0, 220.0])  # Valores extremos
            
        return data
    
    def getHeartRateClassification(self, hr: float) -> str:
        """
        Classifica um valor de HR baseado nos thresholds configurados.
        
        Args:
            hr: Valor de frequência cardíaca em BPM
            
        Returns:
            Classificação textual do HR
        """
        if hr < self.bradycardiaThreshold:
            return "bradycardia"
        elif hr > self.tachycardiaThreshold:
            return "tachycardia"
        elif self.normalRange[0] <= hr <= self.normalRange[1]:
            return "normal"
        else:
            return "borderline"
    
    def generateStreamData(self, durationSeconds: float = 10.0) -> List[Dict[str, Any]]:
        """
        Gera stream contínuo de dados cardíacos para um período especificado.
        
        Útil para simular funcionamento prolongado de dispositivos cardíacos
        com múltiplos batimentos e segmentos ECG sequenciais.
        
        Args:
            durationSeconds: Duração total do stream em segundos
            
        Returns:
            Lista de mensagens com dados cardíacos sequenciais
        """
        messages = []
        
        # Calcular frequências de streaming
        ecgFreq = settings.signals.streamingConfig["cardiacEcgFrequency"]  # 10Hz
        hrFreq = settings.signals.streamingConfig["cardiacHrFrequency"]    # 1Hz
        
        # Calcular número de mensagens
        ecgMessages = int(durationSeconds * ecgFreq)
        hrMessages = int(durationSeconds * hrFreq)
        hrSpacing = int(ecgFreq / hrFreq)  # A cada quantos ECG enviar HR
        
        # Gerar stream intercalado
        for i in range(ecgMessages):
            # Adicionar ECG
            message = self.generateZeroMQMessage()
            message["data"] = {"ecg": self.generateEcgSegment(duration=0.1)}  # 100ms por pacote
            messages.append(message)
            
            # Adicionar HR na frequência configurada
            if i % hrSpacing == 0 and len(messages) <= hrMessages:
                hrMessage = self.generateZeroMQMessage()
                hrMessage["data"] = {"hr": self.generateHrEvent()}
                messages.append(hrMessage)
        
        self.logger.info(f"Generated {len(messages)} cardiac messages for {durationSeconds}s stream")
        return messages
    
    def getCardiacInfo(self) -> Dict[str, Any]:
        """
        Retorna informação completa sobre as configurações cardíacas actuais.
        
        Returns:
            Dicionário com todas as configurações e thresholds
        """
        return {
            "baseHr": self.baseHr,
            "currentVariationStd": self.hrVariationStd,
            "normalRange": self.normalRange,
            "criticalRange": self.criticalRange,
            "thresholds": {
                "bradycardia": self.bradycardiaThreshold,
                "tachycardia": self.tachycardiaThreshold
            },
            "ecgConfig": {
                "amplitudePrimary": self.ecgAmplitudePrimary,
                "amplitudeSecondary": self.ecgAmplitudeSecondary,
                "noiseStd": self.ecgNoiseStd,
                "clipRange": self.ecgClipRange
            },
            "anomalyChance": self.anomalyChance
        }