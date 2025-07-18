"""
CameraFaceLandmarksGenerator - Gerador de dados de face landmarks com imagem mock

Resumo:
Gera dados realistas de face landmarks (478 pontos), gaze tracking, Eye Aspect Ratio
e blink detection com imagem visual coordenada. Simula padrões naturais de atenção,
sonolência e movimento facial. A imagem mock é desenhada baseada nos landmarks gerados
e coordena blinks visuais com valores EAR baixos.
"""

import logging
import numpy as np
import base64
import io
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from enum import Enum
from PIL import Image, ImageDraw

from app.core import settings

class CameraAnomalyType(Enum):
    """Tipos de anomalias específicas de dados de câmera"""
    NORMAL = "normal"
    LOW_BLINK_RATE = "low_blink_rate"                    # Poucas piscadelas (sonolência)
    HIGH_BLINK_RATE = "high_blink_rate"                  # Muitas piscadelas (stress)
    POOR_DETECTION = "poor_detection"                    # Qualidade de deteção baixa
    GAZE_DRIFT = "gaze_drift"                           # Olhar muito desviado
    EXCESSIVE_MOVEMENT = "excessive_movement"            # Movimento excessivo da cabeça
    DISTRACTED_GAZE = "distracted_gaze"                 # Padrão de olhar errático

class AttentionPattern(Enum):
    """Padrões de atenção simulados"""
    FOCUSED = "focused"                                  # Focado na estrada
    DISTRACTED = "distracted"                           # Distraído
    DROWSY = "drowsy"                                    # Sonolento
    ALERT = "alert"                                      # Muito alerta
    CHECKING_MIRRORS = "checking_mirrors"               # A verificar espelhos
    LOOKING_ASIDE = "looking_aside"                     # A olhar para o lado
    READING_DASHBOARD = "reading_dashboard"             # A ler dashboard

class CameraFaceLandmarksGenerator:
    """Gerador de dados de face landmarks para tópico Camera_FaceLandmarks"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Configurações Camera do settings
        self.cameraConfig = settings.signals.cameraConfig
        self.landmarksConfig = self.cameraConfig["faceLandmarks"]
        self.gazeConfig = self.cameraConfig["gaze"]
        self.blinkConfig = self.cameraConfig["blinkRate"]
        self.earConfig = self.cameraConfig["ear"]
        self.mockConfig = settings.mockZeromq
        
        # Configurações de geração
        self.fps = self.landmarksConfig["fps"]                                    # 0.5Hz
        self.frameDuration = 1.0 / self.fps                                      # 2s por frame
        self.landmarksCount = self.landmarksConfig["landmarksCount"]             # 478
        self.detectionThreshold = self.landmarksConfig["detectionThreshold"]     # 0.5
        
        # Configurações de anomalias
        self.anomalyConfig = self.mockConfig.anomalyInjection
        self.anomalyChance = self.anomalyConfig["topicChances"]["Camera_FaceLandmarks"]  # 1%
        
        # Estado interno do gerador
        self.currentTimestamp = 0.0
        self.frameCounter = 0
        self.lastAnomalyTime = 0.0
        self.currentAnomalyType = CameraAnomalyType.NORMAL
        self.anomalyDuration = 0.0
        self.anomalyStartTime = 0.0
        
        # Estado de atenção simulada
        self.currentAttentionPattern = AttentionPattern.FOCUSED
        self.patternStartTime = 0.0
        self.patternDuration = 0.0
        
        # Estado facial
        self.currentEar = 0.3                           # Eye Aspect Ratio atual
        self.isBlinking = False                         # Estado atual de blink
        self.blinkStartTime = 0.0                       # Timestamp do início do blink
        self.blinkDuration = 0.15                       # Duração típica do blink (150ms)
        self.lastBlinkTime = 0.0                        # Último blink registado
        self.blinkCounter = 0                           # Contador total de blinks
        self.recentBlinkTimes: List[float] = []         # Timestamps dos últimos blinks
        
        # Gaze tracking
        self.currentGazeVector = {"dx": 0.0, "dy": 0.0}  # Direção atual do olhar
        self.gazeTarget = {"dx": 0.0, "dy": 0.0}         # Target para suavização
        self.gazeSmoothingFactor = 0.1                   # Factor de suavização
        
        # Face landmarks base (template facial normalizado)
        self.baseLandmarks = self._generateBaseFaceLandmarks()
        self.currentLandmarks = self.baseLandmarks.copy()
        
        # Parâmetros de movimento facial
        self.headPosition = np.array([0.5, 0.5, 0.0])   # Centro da face normalizado
        self.headRotation = np.array([0.0, 0.0, 0.0])   # Rotação da cabeça (pitch, yaw, roll)
        self.microMovementPhase = 0.0                    # Fase para micro-movimentos
        
        # Configurações de imagem
        self.imageSize = (200, 200)                      # Tamanho da imagem mock
        self.imageQuality = 85                           # Qualidade JPEG
        
        self.logger.info(f"CameraFaceLandmarksGenerator initialized - {self.fps}Hz, {self.landmarksCount} landmarks")
    
    def generateFrame(self, baseTimestamp: Optional[float] = None) -> Dict[str, Any]:
        """
        Gera um frame de dados de câmera (landmarks + imagem).
        
        Args:
            baseTimestamp: Timestamp base para o frame (usa interno se None)
            
        Returns:
            Dict com dados de câmera para formatação
        """
        
        if baseTimestamp is not None:
            self.currentTimestamp = baseTimestamp
        
        try:
            # Atualizar padrão de atenção
            self._updateAttentionPattern()
            
            # Verificar se deve injetar anomalia
            self._updateAnomalyState()
            
            # Atualizar estado de blink
            self._updateBlinkState()
            
            # Atualizar gaze tracking
            self._updateGazeTracking()
            
            # Atualizar movimento da cabeça
            self._updateHeadMovement()
            
            # Gerar landmarks baseados no estado atual
            landmarks = self._generateCurrentLandmarks()
            
            # Calcular valores derivados
            ear = self._calculateEAR(landmarks)
            blinkRate = self._calculateBlinkRate()
            confidence = self._calculateDetectionConfidence()
            
            # Gerar imagem mock coordenada
            frameImage = self._generateMockImage(landmarks, ear)
            
            # Avançar timestamp para próximo frame
            self.currentTimestamp += self.frameDuration
            self.frameCounter += 1
            
            result = {
                "landmarks": landmarks.tolist(),
                "gaze_vector": self.currentGazeVector.copy(),
                "ear": ear,
                "blink_rate": blinkRate,
                "blink_counter": self.blinkCounter,
                "confidence": confidence,
                "frame_b64": frameImage,
                "frameTimestamp": self.currentTimestamp - self.frameDuration,
                "anomalyType": self.currentAnomalyType.value,
                "attentionPattern": self.currentAttentionPattern.value,
                "isBlinking": self.isBlinking,
                "frameNumber": self.frameCounter
            }
            
            self.logger.debug(f"Generated camera frame {self.frameCounter}: EAR={ear:.3f}, BlinkRate={blinkRate:.1f}, Confidence={confidence:.3f}")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error generating camera frame: {e}")
            raise
    
    def _generateBaseFaceLandmarks(self) -> np.ndarray:
        """
        Gera template base de 478 landmarks faciais normalizados.
        Simplificado mas anatomicamente plausível.
        
        Returns:
            Array (478, 3) com landmarks base
        """
        
        landmarks = np.zeros((478, 3))
        
        # Face outline (contorno facial) - índices 0-16
        faceOutline = self._generateFaceOutline()
        landmarks[0:17] = faceOutline
        
        # Sobrancelhas - índices 17-26
        eyebrows = self._generateEyebrows()
        landmarks[17:27] = eyebrows
        
        # Olho esquerdo - índices 36-41
        leftEye = self._generateLeftEye()
        landmarks[36:42] = leftEye
        
        # Olho direito - índices 42-47
        rightEye = self._generateRightEye()
        landmarks[42:48] = rightEye
        
        # Nariz - índices 27-35
        nose = self._generateNose()
        landmarks[27:36] = nose
        
        # Boca - índices 48-67
        mouth = self._generateMouth()
        landmarks[48:68] = mouth
        
        # Preencher landmarks restantes com distribuição facial plausível
        self._fillRemainingLandmarks(landmarks)
        
        return landmarks
    
    def _generateFaceOutline(self) -> np.ndarray:
        """Gera contorno facial oval"""
        outline = np.zeros((17, 3))
        
        # Contorno oval de 0.3 a 0.7 em X, 0.2 a 0.9 em Y
        for i in range(17):
            angle = i * np.pi / 16  # 0 a π
            x = 0.5 + 0.2 * np.cos(angle + np.pi/2)  # 0.3 a 0.7
            y = 0.2 + 0.35 * (1 - np.cos(angle))     # 0.2 a 0.9
            z = 0.0  # Plano frontal
            outline[i] = [x, y, z]
        
        return outline
    
    def _generateEyebrows(self) -> np.ndarray:
        """Gera sobrancelhas"""
        eyebrows = np.zeros((10, 3))
        
        # Sobrancelha esquerda (5 pontos)
        for i in range(5):
            x = 0.35 + i * 0.05     # 0.35 a 0.55
            y = 0.35 - 0.02 * np.sin(i * np.pi / 4)  # Curva ligeira
            eyebrows[i] = [x, y, 0.0]
        
        # Sobrancelha direita (5 pontos)
        for i in range(5):
            x = 0.65 - i * 0.05     # 0.65 a 0.45
            y = 0.35 - 0.02 * np.sin(i * np.pi / 4)
            eyebrows[5 + i] = [x, y, 0.0]
        
        return eyebrows
    
    def _generateLeftEye(self) -> np.ndarray:
        """Gera landmarks do olho esquerdo"""
        leftEye = np.zeros((6, 3))
        
        # Forma amendoada do olho
        centerX, centerY = 0.37, 0.45
        width, height = 0.06, 0.03
        
        # 6 pontos do olho: canto interno, superior, canto externo, inferior, etc.
        eyePoints = [
            [centerX - width/2, centerY, 0.0],      # Canto interno
            [centerX - width/4, centerY - height, 0.0],  # Superior esquerdo
            [centerX + width/4, centerY - height, 0.0],  # Superior direito
            [centerX + width/2, centerY, 0.0],           # Canto externo
            [centerX + width/4, centerY + height, 0.0],  # Inferior direito
            [centerX - width/4, centerY + height, 0.0]   # Inferior esquerdo
        ]
        
        leftEye = np.array(eyePoints)
        return leftEye
    
    def _generateRightEye(self) -> np.ndarray:
        """Gera landmarks do olho direito (simétrico ao esquerdo)"""
        rightEye = np.zeros((6, 3))
        
        # Forma amendoada do olho (simétrico)
        centerX, centerY = 0.63, 0.45
        width, height = 0.06, 0.03
        
        eyePoints = [
            [centerX - width/2, centerY, 0.0],      # Canto interno
            [centerX - width/4, centerY - height, 0.0],  # Superior esquerdo
            [centerX + width/4, centerY - height, 0.0],  # Superior direito
            [centerX + width/2, centerY, 0.0],           # Canto externo
            [centerX + width/4, centerY + height, 0.0],  # Inferior direito
            [centerX - width/4, centerY + height, 0.0]   # Inferior esquerdo
        ]
        
        rightEye = np.array(eyePoints)
        return rightEye
    
    def _generateNose(self) -> np.ndarray:
        """Gera landmarks do nariz"""
        nose = np.zeros((9, 3))
        
        # Nariz central
        centerX = 0.5
        
        # Ponte do nariz (3 pontos)
        nose[0] = [centerX, 0.45, 0.02]      # Topo
        nose[1] = [centerX, 0.52, 0.01]      # Meio
        nose[2] = [centerX, 0.59, 0.0]       # Base
        
        # Narinas (6 pontos)
        for i in range(3):
            # Narina esquerda
            nose[3 + i] = [centerX - 0.02 - i*0.01, 0.58 + i*0.01, 0.0]
            # Narina direita
            nose[6 + i] = [centerX + 0.02 + i*0.01, 0.58 + i*0.01, 0.0]
        
        return nose
    
    def _generateMouth(self) -> np.ndarray:
        """Gera landmarks da boca"""
        mouth = np.zeros((20, 3))
        
        centerX, centerY = 0.5, 0.75
        width, height = 0.08, 0.03
        
        # Contorno exterior da boca (12 pontos)
        for i in range(12):
            angle = i * 2 * np.pi / 12
            x = centerX + (width/2) * np.cos(angle)
            y = centerY + (height/2) * np.sin(angle) * 0.6  # Forma oval
            mouth[i] = [x, y, 0.0]
        
        # Contorno interior (8 pontos)
        for i in range(8):
            angle = i * 2 * np.pi / 8
            x = centerX + (width/3) * np.cos(angle)
            y = centerY + (height/3) * np.sin(angle) * 0.4
            mouth[12 + i] = [x, y, 0.0]
        
        return mouth
    
    def _fillRemainingLandmarks(self, landmarks: np.ndarray):
        """Preenche landmarks restantes com distribuição facial plausível"""
        
        # Para landmarks não definidos explicitamente, distribuir pela face
        filledCount = 68  # Landmarks já definidos
        remaining = 478 - filledCount
        
        for i in range(remaining):
            # Distribuir aleatoriamente mas dentro da região facial
            x = np.random.uniform(0.3, 0.7)
            y = np.random.uniform(0.3, 0.8)
            z = np.random.uniform(-0.02, 0.02)
            landmarks[filledCount + i] = [x, y, z]
    
    def _updateAttentionPattern(self):
        """Atualiza padrão de atenção baseado em probabilidades e timing"""
        
        currentTime = self.currentTimestamp
        
        # Verificar se deve mudar padrão
        if currentTime - self.patternStartTime >= self.patternDuration:
            # Escolher novo padrão baseado em probabilidades
            patterns = [
                AttentionPattern.FOCUSED,           # 60% - Mais comum durante condução
                AttentionPattern.CHECKING_MIRRORS,  # 15% - Verificar espelhos
                AttentionPattern.LOOKING_ASIDE,     # 10% - Olhar para o lado
                AttentionPattern.READING_DASHBOARD, # 8%  - Ler dashboard
                AttentionPattern.DISTRACTED,        # 4%  - Distraído
                AttentionPattern.DROWSY,            # 2%  - Sonolento
                AttentionPattern.ALERT              # 1%  - Muito alerta
            ]
            
            weights = [0.60, 0.15, 0.10, 0.08, 0.04, 0.02, 0.01]
            self.currentAttentionPattern = np.random.choice(patterns, p=weights)
            
            self.patternStartTime = currentTime
            
            # Duração do padrão baseada no tipo
            if self.currentAttentionPattern == AttentionPattern.FOCUSED:
                self.patternDuration = np.random.uniform(20.0, 60.0)
            elif self.currentAttentionPattern == AttentionPattern.DROWSY:
                self.patternDuration = np.random.uniform(10.0, 30.0)
            elif self.currentAttentionPattern in [AttentionPattern.CHECKING_MIRRORS, AttentionPattern.READING_DASHBOARD]:
                self.patternDuration = np.random.uniform(2.0, 8.0)
            else:
                self.patternDuration = np.random.uniform(5.0, 15.0)
            
            self.logger.debug(f"Attention pattern changed to: {self.currentAttentionPattern.value} for {self.patternDuration:.1f}s")
    
    def _updateBlinkState(self):
        """Atualiza estado de piscadelas baseado em padrões naturais"""
        
        currentTime = self.currentTimestamp
        
        # Se estiver a piscar, verificar se deve terminar
        if self.isBlinking:
            if currentTime - self.blinkStartTime >= self.blinkDuration:
                self.isBlinking = False
                self.logger.debug(f"Blink ended at {currentTime:.3f}s")
            return
        
        # Calcular probabilidade de blink baseada no padrão de atenção
        baseProbability = 0.02  # 2% chance por frame (0.5Hz)
        
        if self.currentAttentionPattern == AttentionPattern.DROWSY:
            blinkProbability = baseProbability * 0.3  # Menos blinks quando sonolento
        elif self.currentAttentionPattern == AttentionPattern.ALERT:
            blinkProbability = baseProbability * 2.0  # Mais blinks quando alerta
        elif self.currentAttentionPattern == AttentionPattern.DISTRACTED:
            blinkProbability = baseProbability * 1.5  # Ligeiramente mais blinks
        else:
            blinkProbability = baseProbability
        
        # Evitar blinks muito próximos
        timeSinceLastBlink = currentTime - self.lastBlinkTime
        if timeSinceLastBlink < 1.0:  # Mínimo 1s entre blinks
            blinkProbability *= 0.1
        
        # Decidir se deve piscar
        if np.random.random() < blinkProbability:
            self.isBlinking = True
            self.blinkStartTime = currentTime
            self.lastBlinkTime = currentTime
            self.blinkCounter += 1
            self.blinkDuration = np.random.uniform(0.1, 0.2)  # 100-200ms
            
            # Adicionar ao histórico de blinks
            self.recentBlinkTimes.append(currentTime)
            
            # Manter apenas blinks dos últimos 60 segundos
            cutoffTime = currentTime - 60.0
            self.recentBlinkTimes = [t for t in self.recentBlinkTimes if t > cutoffTime]
            
            self.logger.debug(f"Blink started at {currentTime:.3f}s (duration: {self.blinkDuration:.3f}s)")
    
    def _updateGazeTracking(self):
        """Atualiza direção do olhar baseada no padrão de atenção"""
        
        # Definir target do gaze baseado no padrão atual
        if self.currentAttentionPattern == AttentionPattern.FOCUSED:
            # Focado na estrada - ligeira variação em torno do centro
            self.gazeTarget["dx"] = np.random.normal(0.0, 0.1)
            self.gazeTarget["dy"] = np.random.normal(-0.1, 0.1)  # Ligeiramente para baixo
            
        elif self.currentAttentionPattern == AttentionPattern.CHECKING_MIRRORS:
            # Verificar espelhos - olhar para os lados
            direction = np.random.choice([-1, 1])
            self.gazeTarget["dx"] = direction * np.random.uniform(0.6, 0.9)
            self.gazeTarget["dy"] = np.random.uniform(-0.2, 0.1)
            
        elif self.currentAttentionPattern == AttentionPattern.LOOKING_ASIDE:
            # Olhar para o lado
            self.gazeTarget["dx"] = np.random.uniform(-0.8, 0.8)
            self.gazeTarget["dy"] = np.random.uniform(-0.3, 0.3)
            
        elif self.currentAttentionPattern == AttentionPattern.READING_DASHBOARD:
            # Ler dashboard - olhar para baixo
            self.gazeTarget["dx"] = np.random.uniform(-0.3, 0.3)
            self.gazeTarget["dy"] = np.random.uniform(0.4, 0.7)
            
        elif self.currentAttentionPattern == AttentionPattern.DISTRACTED:
            # Distraído - olhar errático
            self.gazeTarget["dx"] = np.random.uniform(-0.9, 0.9)
            self.gazeTarget["dy"] = np.random.uniform(-0.5, 0.5)
            
        elif self.currentAttentionPattern == AttentionPattern.DROWSY:
            # Sonolento - olhar para baixo, movimento lento
            self.gazeTarget["dx"] = np.random.normal(0.0, 0.2)
            self.gazeTarget["dy"] = np.random.uniform(0.2, 0.6)
            
        elif self.currentAttentionPattern == AttentionPattern.ALERT:
            # Alerta - movimento rápido mas controlado
            self.gazeTarget["dx"] = np.random.uniform(-0.4, 0.4)
            self.gazeTarget["dy"] = np.random.uniform(-0.3, 0.2)
        
        # Suavizar movimento do gaze
        dx_diff = self.gazeTarget["dx"] - self.currentGazeVector["dx"]
        dy_diff = self.gazeTarget["dy"] - self.currentGazeVector["dy"]
        
        self.currentGazeVector["dx"] += dx_diff * self.gazeSmoothingFactor
        self.currentGazeVector["dy"] += dy_diff * self.gazeSmoothingFactor
        
        # Clipar para range válido
        self.currentGazeVector["dx"] = np.clip(self.currentGazeVector["dx"], -1.0, 1.0)
        self.currentGazeVector["dy"] = np.clip(self.currentGazeVector["dy"], -1.0, 1.0)
    
    def _updateHeadMovement(self):
        """Atualiza movimento subtil da cabeça"""
        
        # Micro-movimentos naturais
        self.microMovementPhase += 0.1
        
        # Variação ligeira na posição da cabeça
        headNoise = np.random.normal(0, 0.005, 3)  # Muito subtil
        microMovement = np.array([
            0.002 * np.sin(self.microMovementPhase),
            0.001 * np.cos(self.microMovementPhase * 1.3),
            0.001 * np.sin(self.microMovementPhase * 0.7)
        ])
        
        self.headPosition += headNoise + microMovement
        
        # Manter dentro de limites razoáveis
        self.headPosition = np.clip(self.headPosition, [0.45, 0.45, -0.05], [0.55, 0.55, 0.05])
    
    def _generateCurrentLandmarks(self) -> np.ndarray:
        """Gera landmarks atuais baseados no estado facial"""
        
        # Começar com landmarks base
        landmarks = self.baseLandmarks.copy()
        
        # Aplicar movimento da cabeça (translação ligeira)
        headMovement = self.headPosition - np.array([0.5, 0.5, 0.0])
        landmarks += headMovement
        
        # Aplicar efeito do gaze nos olhos
        self._applyGazeToEyes(landmarks)
        
        # Aplicar efeito do blink nos olhos
        if self.isBlinking:
            self._applyBlinkToEyes(landmarks)
        
        # Adicionar variação natural muito ligeira
        naturalVariation = np.random.normal(0, 0.001, landmarks.shape)
        landmarks += naturalVariation
        
        # Aplicar anomalias se ativas
        if self.currentAnomalyType != CameraAnomalyType.NORMAL:
            landmarks = self._applyAnomalies(landmarks)
        
        # Garantir que landmarks ficam normalizados
        landmarks = np.clip(landmarks, 0.0, 1.0)
        
        return landmarks
    
    def _applyGazeToEyes(self, landmarks: np.ndarray):
        """Aplica efeito do gaze aos landmarks dos olhos"""
        
        gazeShift = np.array([self.currentGazeVector["dx"] * 0.01, self.currentGazeVector["dy"] * 0.01, 0])
        
        # Aplicar aos olhos (índices aproximados)
        landmarks[36:48] += gazeShift  # Ambos os olhos
    
    def _applyBlinkToEyes(self, landmarks: np.ndarray):
        """Aplica efeito do blink aos landmarks dos olhos"""
        
        # Durante blink, reduzir height dos olhos
        blinkIntensity = 0.02  # Redução em Y
        
        # Aplicar aos pontos superiores e inferiores dos olhos
        # Olho esquerdo (36-41)
        landmarks[37, 1] += blinkIntensity  # Ponto superior
        landmarks[38, 1] += blinkIntensity
        landmarks[40, 1] -= blinkIntensity  # Ponto inferior
        landmarks[41, 1] -= blinkIntensity
        
        # Olho direito (42-47)
        landmarks[43, 1] += blinkIntensity  # Ponto superior
        landmarks[44, 1] += blinkIntensity
        landmarks[46, 1] -= blinkIntensity  # Ponto inferior
        landmarks[47, 1] -= blinkIntensity
    
    def _calculateEAR(self, landmarks: np.ndarray) -> float:
        """Calcula Eye Aspect Ratio baseado nos landmarks dos olhos"""
        
        if self.isBlinking:
            # Durante blink, EAR muito baixo
            return np.random.uniform(0.05, 0.12)
        else:
            # EAR normal com ligeira variação
            baseEar = 0.3
            
            if self.currentAttentionPattern == AttentionPattern.DROWSY:
                baseEar = 0.2  # EAR mais baixo quando sonolento
            elif self.currentAttentionPattern == AttentionPattern.ALERT:
                baseEar = 0.35  # EAR mais alto quando alerta
            
            # Adicionar variação natural
            ear = baseEar + np.random.normal(0, 0.03)
            return np.clip(ear, 0.1, 0.45)
    
    def _calculateBlinkRate(self) -> float:
        """Calcula taxa de piscadelas em blinks por minuto"""
        
        currentTime = self.currentTimestamp
        
        # Contar blinks nos últimos 60 segundos
        cutoffTime = currentTime - 60.0
        recentBlinks = [t for t in self.recentBlinkTimes if t > cutoffTime]
        
        # Calcular rate (blinks por minuto)
        blinkRate = len(recentBlinks)
        
        # Ajustar baseado no padrão de atenção
        if self.currentAttentionPattern == AttentionPattern.DROWSY:
            blinkRate *= 0.4  # Significativamente menos blinks
        elif self.currentAttentionPattern == AttentionPattern.ALERT:
            blinkRate *= 1.8  # Mais blinks
        
        return max(0.0, blinkRate)
    
    def _calculateDetectionConfidence(self) -> float:
        """Calcula confiança da deteção baseada em qualidade simulada"""
        
        baseConfidence = 0.85
        
        # Reduzir confiança durante anomalias
        if self.currentAnomalyType == CameraAnomalyType.POOR_DETECTION:
            baseConfidence = 0.3
        elif self.currentAnomalyType == CameraAnomalyType.EXCESSIVE_MOVEMENT:
            baseConfidence = 0.6
        elif self.currentAnomalyType != CameraAnomalyType.NORMAL:
            baseConfidence *= 0.9
        
        # Adicionar variação natural
        confidence = baseConfidence + np.random.normal(0, 0.05)
        return np.clip(confidence, 0.1, 1.0)
    
    def _generateMockImage(self, landmarks: np.ndarray, ear: float) -> str:
        """
        Gera imagem mock da face baseada nos landmarks.
        
        Args:
            landmarks: Array de landmarks faciais
            ear: Eye Aspect Ratio atual
            
        Returns:
            Imagem encoded em base64
        """
        
        try:
            # Criar imagem
            img = Image.new('RGB', self.imageSize, color='lightblue')
            draw = ImageDraw.Draw(img)
            
            # Converter landmarks normalizados para pixels
            imgWidth, imgHeight = self.imageSize
            pixelLandmarks = landmarks.copy()
            pixelLandmarks[:, 0] *= imgWidth   # X para pixels
            pixelLandmarks[:, 1] *= imgHeight  # Y para pixels
            
            # Desenhar contorno facial
            self._drawFaceOutline(draw, pixelLandmarks)
            
            # Desenhar features faciais
            self._drawEyebrows(draw, pixelLandmarks)
            self._drawNose(draw, pixelLandmarks)
            self._drawMouth(draw, pixelLandmarks)
            
            # Desenhar olhos (coordenados com EAR)
            self._drawEyes(draw, pixelLandmarks, ear)
            
            # Adicionar pupils baseadas no gaze
            self._drawPupils(draw, pixelLandmarks, ear)
            
            # Converter para base64
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=self.imageQuality)
            imgBytes = buffer.getvalue()
            
            return base64.b64encode(imgBytes).decode('utf-8')
            
        except Exception as e:
            self.logger.error(f"Error generating mock image: {e}")
            # Retornar placeholder em caso de erro
            return "mock_camera_frame_error"
    
    def _drawFaceOutline(self, draw: ImageDraw.Draw, landmarks: np.ndarray):
        """Desenha contorno facial baseado nos landmarks"""
        
        # Usar landmarks 0-16 para contorno
        facePoints = [(landmarks[i, 0], landmarks[i, 1]) for i in range(17)]
        
        if len(facePoints) > 2:
            draw.polygon(facePoints, outline='black', width=2)
    
    def _drawEyebrows(self, draw: ImageDraw.Draw, landmarks: np.ndarray):
        """Desenha sobrancelhas"""
        
        # Sobrancelha esquerda (landmarks 17-21)
        leftBrow = [(landmarks[i, 0], landmarks[i, 1]) for i in range(17, 22)]
        if len(leftBrow) > 1:
            for i in range(len(leftBrow) - 1):
                draw.line([leftBrow[i], leftBrow[i+1]], fill='darkbrown', width=2)
        
        # Sobrancelha direita (landmarks 22-26)
        rightBrow = [(landmarks[i, 0], landmarks[i, 1]) for i in range(22, 27)]
        if len(rightBrow) > 1:
            for i in range(len(rightBrow) - 1):
                draw.line([rightBrow[i], rightBrow[i+1]], fill='darkbrown', width=2)
    
    def _drawNose(self, draw: ImageDraw.Draw, landmarks: np.ndarray):
        """Desenha nariz"""
        
        # Ponte do nariz (landmarks 27-35)
        nosePoints = [(landmarks[i, 0], landmarks[i, 1]) for i in range(27, 36)]
        
        if len(nosePoints) >= 3:
            # Desenhar ponte
            for i in range(3):
                if i < len(nosePoints) - 1:
                    draw.line([nosePoints[i], nosePoints[i+1]], fill='black', width=1)
            
            # Desenhar narinas
            if len(nosePoints) >= 6:
                # Narina esquerda
                draw.ellipse([nosePoints[3][0]-2, nosePoints[3][1]-1, 
                             nosePoints[3][0]+2, nosePoints[3][1]+1], 
                             outline='black')
                # Narina direita  
                draw.ellipse([nosePoints[6][0]-2, nosePoints[6][1]-1,
                             nosePoints[6][0]+2, nosePoints[6][1]+1], 
                             outline='black')
    
    def _drawMouth(self, draw: ImageDraw.Draw, landmarks: np.ndarray):
        """Desenha boca"""
        
        # Contorno da boca (landmarks 48-67)
        mouthPoints = [(landmarks[i, 0], landmarks[i, 1]) for i in range(48, 60)]
        
        if len(mouthPoints) >= 8:
            # Desenhar contorno exterior
            mouthPoints.append(mouthPoints[0])  # Fechar polygon
            draw.polygon(mouthPoints, outline='red', width=2)
    
    def _drawEyes(self, draw: ImageDraw.Draw, landmarks: np.ndarray, ear: float):
        """Desenha olhos coordenados com EAR"""
        
        # Olho esquerdo (landmarks 36-41)
        leftEyePoints = [(landmarks[i, 0], landmarks[i, 1]) for i in range(36, 42)]
        
        # Olho direito (landmarks 42-47)
        rightEyePoints = [(landmarks[i, 0], landmarks[i, 1]) for i in range(42, 48)]
        
        # Determinar se olhos estão fechados baseado em EAR
        eyesClosed = ear < 0.15 or self.isBlinking
        
        if eyesClosed:
            # Desenhar olhos fechados (linhas horizontais)
            if len(leftEyePoints) >= 4:
                draw.line([leftEyePoints[0], leftEyePoints[3]], fill='black', width=3)
            if len(rightEyePoints) >= 4:
                draw.line([rightEyePoints[0], rightEyePoints[3]], fill='black', width=3)
        else:
            # Desenhar olhos abertos (elipses)
            if len(leftEyePoints) >= 6:
                # Calcular bounding box do olho esquerdo
                leftX = [p[0] for p in leftEyePoints]
                leftY = [p[1] for p in leftEyePoints]
                leftBbox = [min(leftX), min(leftY), max(leftX), max(leftY)]
                draw.ellipse(leftBbox, outline='black', fill='white', width=2)
            
            if len(rightEyePoints) >= 6:
                # Calcular bounding box do olho direito
                rightX = [p[0] for p in rightEyePoints]
                rightY = [p[1] for p in rightEyePoints]
                rightBbox = [min(rightX), min(rightY), max(rightX), max(rightY)]
                draw.ellipse(rightBbox, outline='black', fill='white', width=2)
    
    def _drawPupils(self, draw: ImageDraw.Draw, landmarks: np.ndarray, ear: float):
        """Desenha pupilas baseadas no gaze direction"""
        
        # Só desenhar pupilas se olhos estiverem abertos
        if ear < 0.15 or self.isBlinking:
            return
        
        # Calcular posição das pupilas baseada no gaze
        gazeOffsetX = self.currentGazeVector["dx"] * 3  # Pixels
        gazeOffsetY = self.currentGazeVector["dy"] * 2  # Pixels
        
        # Pupila esquerda
        if len(landmarks) > 39:
            eyeCenterX = landmarks[39, 0]  # Centro aproximado do olho esquerdo
            eyeCenterY = landmarks[39, 1]
            
            pupilX = eyeCenterX + gazeOffsetX
            pupilY = eyeCenterY + gazeOffsetY
            
            draw.ellipse([pupilX-2, pupilY-2, pupilX+2, pupilY+2], 
                        fill='black')
        
        # Pupila direita
        if len(landmarks) > 45:
            eyeCenterX = landmarks[45, 0]  # Centro aproximado do olho direito
            eyeCenterY = landmarks[45, 1]
            
            pupilX = eyeCenterX + gazeOffsetX
            pupilY = eyeCenterY + gazeOffsetY
            
            draw.ellipse([pupilX-2, pupilY-2, pupilX+2, pupilY+2], 
                        fill='black')
    
    def _applyAnomalies(self, landmarks: np.ndarray) -> np.ndarray:
        """Aplica anomalias específicas aos landmarks"""
        
        if self.currentAnomalyType == CameraAnomalyType.EXCESSIVE_MOVEMENT:
            # Movimento excessivo - maior variação
            movement = np.random.normal(0, 0.01, landmarks.shape)
            landmarks += movement
            
        elif self.currentAnomalyType == CameraAnomalyType.POOR_DETECTION:
            # Deteção pobre - landmarks menos precisos
            noise = np.random.normal(0, 0.005, landmarks.shape)
            landmarks += noise
            
        elif self.currentAnomalyType == CameraAnomalyType.GAZE_DRIFT:
            # Gaze errático - forçar gaze extremo
            self.currentGazeVector["dx"] = np.random.uniform(-0.9, 0.9)
            self.currentGazeVector["dy"] = np.random.uniform(-0.9, 0.9)
        
        return landmarks
    
    def _updateAnomalyState(self):
        """Atualiza estado de anomalias baseado em probabilidades"""
        
        currentTime = self.currentTimestamp
        
        # Se já há uma anomalia ativa, verificar se deve terminar
        if self.currentAnomalyType != CameraAnomalyType.NORMAL:
            if currentTime - self.anomalyStartTime >= self.anomalyDuration:
                self.currentAnomalyType = CameraAnomalyType.NORMAL
                self.logger.debug(f"Camera anomaly ended at {currentTime:.3f}s")
            return
        
        # Verificar se deve injetar nova anomalia
        if not self.anomalyConfig["enabled"]:
            return
        
        # Intervalo mínimo entre anomalias
        if currentTime - self.lastAnomalyTime < self.anomalyConfig["minInterval"]:
            return
        
        # Probabilidade de anomalia
        if np.random.random() < self.anomalyChance:
            # Escolher tipo de anomalia
            anomalyTypes = [
                CameraAnomalyType.LOW_BLINK_RATE,        # 30% - Sonolência
                CameraAnomalyType.GAZE_DRIFT,            # 25% - Distração
                CameraAnomalyType.POOR_DETECTION,        # 20% - Qualidade baixa
                CameraAnomalyType.EXCESSIVE_MOVEMENT,    # 15% - Movimento excessivo
                CameraAnomalyType.HIGH_BLINK_RATE,       # 10% - Stress
            ]
            
            weights = [0.30, 0.25, 0.20, 0.15, 0.10]
            self.currentAnomalyType = np.random.choice(anomalyTypes, p=weights)
            
            self.anomalyStartTime = currentTime
            self.lastAnomalyTime = currentTime
            
            # Duração baseada no tipo
            if self.currentAnomalyType == CameraAnomalyType.LOW_BLINK_RATE:
                self.anomalyDuration = np.random.uniform(15.0, 45.0)  # Longa para sonolência
            elif self.currentAnomalyType == CameraAnomalyType.POOR_DETECTION:
                self.anomalyDuration = np.random.uniform(5.0, 15.0)   # Média
            else:
                self.anomalyDuration = np.random.uniform(3.0, 10.0)   # Curta
            
            self.logger.warning(f"Camera anomaly started: {self.currentAnomalyType.value} for {self.anomalyDuration:.1f}s")
    
    def forceAnomaly(self, anomalyType: str, duration: float = 10.0):
        """
        Força injeção de anomalia específica.
        
        Args:
            anomalyType: Tipo de anomalia ("low_blink_rate", "gaze_drift", etc.)
            duration: Duração da anomalia em segundos
        """
        
        try:
            self.currentAnomalyType = CameraAnomalyType(anomalyType)
            self.anomalyStartTime = self.currentTimestamp
            self.lastAnomalyTime = self.currentTimestamp
            self.anomalyDuration = duration
            
            self.logger.warning(f"Forced camera anomaly: {anomalyType} for {duration}s")
            
        except ValueError:
            self.logger.error(f"Unknown camera anomaly type: {anomalyType}")
    
    def forceAttentionPattern(self, pattern: str, duration: float = 15.0):
        """
        Força padrão de atenção específico.
        
        Args:
            pattern: Padrão de atenção ("focused", "drowsy", etc.)
            duration: Duração do padrão em segundos
        """
        
        try:
            self.currentAttentionPattern = AttentionPattern(pattern)
            self.patternStartTime = self.currentTimestamp
            self.patternDuration = duration
            
            self.logger.info(f"Forced attention pattern: {pattern} for {duration}s")
            
        except ValueError:
            self.logger.error(f"Unknown attention pattern: {pattern}")
    
    def getStatus(self) -> Dict[str, Any]:
        """
        Retorna status atual do gerador.
        
        Returns:
            Status detalhado do gerador
        """
        
        return {
            "generatorType": "CameraFaceLandmarks",
            "fps": self.fps,
            "landmarksCount": self.landmarksCount,
            "currentTimestamp": self.currentTimestamp,
            "frameCounter": self.frameCounter,
            "currentAttentionPattern": self.currentAttentionPattern.value,
            "currentAnomalyType": self.currentAnomalyType.value,
            "anomalyActive": self.currentAnomalyType != CameraAnomalyType.NORMAL,
            "anomalyTimeRemaining": max(0, (self.anomalyStartTime + self.anomalyDuration) - self.currentTimestamp),
            "patternTimeRemaining": max(0, (self.patternStartTime + self.patternDuration) - self.currentTimestamp),
            "blinkState": {
                "isBlinking": self.isBlinking,
                "blinkCounter": self.blinkCounter,
                "currentEar": self.currentEar,
                "recentBlinkRate": self._calculateBlinkRate()
            },
            "gazeState": {
                "currentGaze": self.currentGazeVector.copy(),
                "gazeTarget": self.gazeTarget.copy()
            },
            "detectionQuality": {
                "confidence": self._calculateDetectionConfidence(),
                "imageSize": self.imageSize
            },
            "config": {
                "detectionThreshold": self.detectionThreshold,
                "anomalyChance": self.anomalyChance,
                "blinkRange": self.blinkConfig["normalRange"],
                "earRange": self.earConfig["normalRange"]
            }
        }
    
    def reset(self):
        """Reset do estado interno do gerador"""
        
        self.currentTimestamp = 0.0
        self.frameCounter = 0
        self.lastAnomalyTime = 0.0
        self.currentAnomalyType = CameraAnomalyType.NORMAL
        self.anomalyDuration = 0.0
        self.anomalyStartTime = 0.0
        self.currentAttentionPattern = AttentionPattern.FOCUSED
        self.patternStartTime = 0.0
        self.patternDuration = 0.0
        
        # Reset estado facial
        self.currentEar = 0.3
        self.isBlinking = False
        self.blinkStartTime = 0.0
        self.lastBlinkTime = 0.0
        self.blinkCounter = 0
        self.recentBlinkTimes.clear()
        
        # Reset gaze
        self.currentGazeVector = {"dx": 0.0, "dy": 0.0}
        self.gazeTarget = {"dx": 0.0, "dy": 0.0}
        
        # Reset posição
        self.headPosition = np.array([0.5, 0.5, 0.0])
        self.headRotation = np.array([0.0, 0.0, 0.0])
        self.microMovementPhase = 0.0
        
        # Regenerar landmarks base
        self.baseLandmarks = self._generateBaseFaceLandmarks()
        self.currentLandmarks = self.baseLandmarks.copy()
        
        self.logger.info("CameraFaceLandmarksGenerator reset completed")

# Instância global
cameraFaceLandmarksGenerator = CameraFaceLandmarksGenerator()