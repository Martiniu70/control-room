"""
CameraSignal - Validação e processamento de dados de câmera

Resumo:
Processa dados de face landmarks (478 pontos), gaze tracking, Eye Aspect Ratio
e blink detection provenientes de sistemas como MediaPipe. Valida estrutura dos dados,
detecta anomalias relacionadas com sonolência e distração, e mantém estatísticas
de qualidade de deteção seguindo o padrão da arquitetura de sinais.
"""

import logging
import numpy as np
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple, Union

from ..base import BaseSignal
from ..dataPoint import SignalPoint
from app.core import settings, SignalValidationError

class CameraSignal(BaseSignal):
    """Signal para dados de face landmarks, gaze tracking e blink detection"""
    
    def __init__(self):
        # Configurações baseadas nos settings
        cameraConfig = settings.signals.cameraConfig
        
        super().__init__(
            signalName="camera",
            bufferSize=cameraConfig["faceLandmarks"]["bufferSize"],    # 15 frames (30s * 0.5Hz)
            samplingRate=cameraConfig["faceLandmarks"]["fps"]          # 0.5Hz
        )
        
        # Configurações específicas de câmera
        self.landmarksConfig = cameraConfig["faceLandmarks"]
        self.gazeConfig = cameraConfig["gaze"] 
        self.blinkConfig = cameraConfig["blinkRate"]
        self.earConfig = cameraConfig["ear"]
        
        # Parâmetros de validação
        self.expectedLandmarksCount = self.landmarksConfig["landmarksCount"]      # 478
        self.landmarksDimensions = self.landmarksConfig["landmarksDimensions"]    # 3 (x,y,z)
        self.detectionThreshold = self.landmarksConfig["detectionThreshold"]     # 0.5
        
        # Ranges e thresholds de validação
        self.gazeNormalRange = self.gazeConfig["normalRange"]                    # (-1.0, 1.0)
        self.blinkRateNormalRange = self.blinkConfig["normalRange"]              # (10, 30)
        self.earNormalRange = self.earConfig["normalRange"]                      # (0.15, 0.4)
        
        # Thresholds de anomalias
        self.drowsinessBlinkThreshold = self.blinkConfig["drowsinessThreshold"]  # 8 blinks/min
        self.hyperBlinkThreshold = self.blinkConfig["hyperBlinkThreshold"]       # 40 blinks/min
        self.earBlinkThreshold = self.earConfig["blinkThreshold"]                # 0.12
        self.earDrowsyThreshold = self.earConfig["drowsyThreshold"]              # 0.18
        self.gazeStabilityThreshold = self.gazeConfig["stabilityThreshold"]      # 0.1
        
        # Estado interno para análise de tendências
        self.lastEar: Optional[float] = None
        self.lastBlinkRate: Optional[float] = None
        self.lastGazeVector: Optional[Dict[str, float]] = None
        self.recentEarValues: List[float] = []
        self.consecutiveLowEarCount = 0
        
        self.logger.info(f"CameraSignal initialized - {self.expectedLandmarksCount} landmarks, threshold: {self.detectionThreshold}")
    
    def validateValue(self, value: Any) -> bool:
        """
        Valida estrutura completa dos dados de câmera.
        
        Args:
            value: Dict com dados de câmera processados
            
        Returns:
            True se dados são válidos
            
        Raises:
            SignalValidationError: Se validação falhar
        """
        
        if not isinstance(value, dict):
            raise SignalValidationError(
                signalType="camera",
                value=type(value).__name__,
                reason="Camera data must be a dictionary"
            )
        
        # Verificar campos obrigatórios
        required_fields = ["landmarks", "gaze_vector", "ear", "blink_rate", "confidence"]
        for field in required_fields:
            if field not in value:
                raise SignalValidationError(
                    signalType="camera",
                    value=f"missing_{field}",
                    reason=f"Required field '{field}' missing in camera data"
                )
        
        # Validar landmarks
        landmarks = value["landmarks"]
        if not isinstance(landmarks, (list, np.ndarray)):
            raise SignalValidationError(
                signalType="camera",
                value=type(landmarks).__name__,
                reason="Landmarks must be a list or numpy array"
            )
        
        landmarks_array = np.array(landmarks)
        if landmarks_array.shape != (self.expectedLandmarksCount, self.landmarksDimensions):
            raise SignalValidationError(
                signalType="camera",
                value=f"shape_{landmarks_array.shape}",
                reason=f"Landmarks must have shape ({self.expectedLandmarksCount}, {self.landmarksDimensions})"
            )
        
        # Validar coordenadas normalizadas (0-1)
        if not np.all((landmarks_array >= 0.0) & (landmarks_array <= 1.0)):
            raise SignalValidationError(
                signalType="camera",
                value="coordinates_out_of_range",
                reason="Landmark coordinates must be normalized between 0.0 and 1.0"
            )
        
        # Validar gaze vector
        gaze_vector = value["gaze_vector"]
        if not isinstance(gaze_vector, dict) or "dx" not in gaze_vector or "dy" not in gaze_vector:
            raise SignalValidationError(
                signalType="camera",
                value="invalid_gaze_structure",
                reason="Gaze vector must be dict with 'dx' and 'dy' keys"
            )
        
        dx, dy = gaze_vector["dx"], gaze_vector["dy"]
        if not (self.gazeNormalRange[0] <= dx <= self.gazeNormalRange[1] and
                self.gazeNormalRange[0] <= dy <= self.gazeNormalRange[1]):
            raise SignalValidationError(
                signalType="camera",
                value=f"gaze({dx:.2f},{dy:.2f})",
                reason=f"Gaze vector outside normal range {self.gazeNormalRange}"
            )
        
        # Validar EAR
        ear = value["ear"]
        if not isinstance(ear, (int, float)) or not (0.0 <= ear <= 1.0):
            raise SignalValidationError(
                signalType="camera",
                value=ear,
                reason="EAR must be a number between 0.0 and 1.0"
            )
        
        # Validar blink rate
        blink_rate = value["blink_rate"]
        if not isinstance(blink_rate, (int, float)) or not (0 <= blink_rate <= 120):
            raise SignalValidationError(
                signalType="camera",
                value=blink_rate,
                reason="Blink rate must be between 0 and 120 bpm"
            )
        
        # Validar confidence
        confidence = value["confidence"]
        if not isinstance(confidence, (int, float)) or not (0.0 <= confidence <= 1.0):
            raise SignalValidationError(
                signalType="camera",
                value=confidence,
                reason="Confidence must be between 0.0 and 1.0"
            )
        
        return True
    
    def getNormalRange(self) -> Optional[tuple]:
        """
        Retorna range normal para confiança de deteção.
        
        Returns:
            Range (min, max) para confidence ou None se não aplicável
        """
        return (self.detectionThreshold, 1.0)
    
    def detectAnomalies(self, recentPoints: List[SignalPoint]) -> List[str]:
        """
        Detecta anomalias nos dados de câmera recentes.
        
        Args:
            recentPoints: Lista de pontos recentes do signal
            
        Returns:
            Lista de mensagens de anomalias detectadas
        """
        anomalies = []
        
        if len(recentPoints) < 1:
            return anomalies
        
        # Analisar ponto mais recente
        latest_point = recentPoints[-1]
        if not isinstance(latest_point.value, dict):
            return anomalies
        
        data = latest_point.value
        
        # Extrair valores principais
        ear = data.get("ear")
        blink_rate = data.get("blink_rate")
        confidence = data.get("confidence")
        gaze_vector = data.get("gaze_vector", {})
        
        # Anomalia: Taxa de piscadelas baixa (sonolência)
        if blink_rate is not None and blink_rate < self.drowsinessBlinkThreshold:
            severity = "crítica" if blink_rate < 5 else "moderada"
            anomalies.append(f"Taxa de piscadelas baixa detectada: {blink_rate:.1f} bpm (sonolência {severity})")
        
        # Anomalia: Taxa de piscadelas muito alta (stress/irritação)
        if blink_rate is not None and blink_rate > self.hyperBlinkThreshold:
            severity = "alta" if blink_rate > self.hyperBlinkThreshold * 1.5 else "moderada"
            anomalies.append(f"Taxa de piscadelas excessiva: {blink_rate:.1f} bpm (stress {severity})")
        
        # Anomalia: EAR baixo prolongado (olhos fechados/sonolência)
        if ear is not None and ear < self.earDrowsyThreshold:
            # Atualizar contador de EAR baixo consecutivo
            self.consecutiveLowEarCount += 1
            if self.consecutiveLowEarCount >= 3:  # 3 leituras consecutivas (6 segundos)
                severity = "crítica" if ear < 0.1 else "moderada"
                anomalies.append(f"EAR baixo prolongado: {ear:.3f} (sonolência {severity})")
        else:
            self.consecutiveLowEarCount = 0
        
        # Anomalia: Confiança de deteção baixa (qualidade má)
        if confidence is not None and confidence < self.detectionThreshold:
            severity = "alta" if confidence < 0.3 else "moderada"
            anomalies.append(f"Confiança de deteção baixa: {confidence:.2f} (qualidade {severity})")
        
        # Anomalia: Olhar muito desviado (distração)
        if gaze_vector:
            dx = gaze_vector.get("dx", 0)
            dy = gaze_vector.get("dy", 0)
            gaze_magnitude = np.sqrt(dx**2 + dy**2)
            
            if gaze_magnitude > 0.7:  # Olhar muito afastado do centro
                anomalies.append(f"Olhar desviado detectado: magnitude {gaze_magnitude:.2f} (distração)")
        
        # Anomalia: Variação súbita de EAR (instabilidade)
        if len(recentPoints) >= 3 and ear is not None:
            recent_ears = [p.value.get("ear") for p in recentPoints[-3:] 
                          if isinstance(p.value, dict) and p.value.get("ear") is not None]
            
            if len(recent_ears) >= 3:
                ear_variation = max(recent_ears) - min(recent_ears)
                if ear_variation > 0.2:  # Variação > 20% do range normal
                    anomalies.append(f"Variação súbita no EAR: {ear_variation:.3f} (instabilidade)")
        
        # Anomalia: Drift de gaze (movimento errático)
        if len(recentPoints) >= 2 and gaze_vector:
            prev_point = recentPoints[-2]
            if isinstance(prev_point.value, dict):
                prev_gaze = prev_point.value.get("gaze_vector", {})
                if prev_gaze:
                    dx_change = abs(gaze_vector.get("dx", 0) - prev_gaze.get("dx", 0))
                    dy_change = abs(gaze_vector.get("dy", 0) - prev_gaze.get("dy", 0))
                    gaze_change = np.sqrt(dx_change**2 + dy_change**2)
                    
                    if gaze_change > self.gazeStabilityThreshold:
                        anomalies.append(f"Movimento errático do olhar: mudança {gaze_change:.2f}")
        
        # Atualizar histórico interno
        self._updateInternalHistory(ear, blink_rate, gaze_vector)
        
        return anomalies
    
    def _updateInternalHistory(self, ear: Optional[float], blink_rate: Optional[float], 
                              gaze_vector: Optional[Dict[str, float]]) -> None:
        """
        Atualiza histórico interno para análise de tendências.
        
        Args:
            ear: Eye Aspect Ratio atual
            blink_rate: Taxa de piscadelas atual
            gaze_vector: Vetor de direção do olhar atual
        """
        
        # Atualizar valores anteriores
        self.lastEar = ear
        self.lastBlinkRate = blink_rate
        self.lastGazeVector = gaze_vector.copy() if gaze_vector else None
        
        # Manter histórico de EAR (últimos 10 valores)
        if ear is not None:
            self.recentEarValues.append(ear)
            if len(self.recentEarValues) > 10:
                self.recentEarValues.pop(0)
    
    def _extractNumericValues(self, points: List[SignalPoint]) -> List[float]:
        """
        Extrai valores numéricos dos pontos para cálculo de métricas.
        Usa confidence como valor numérico principal.
        
        Args:
            points: Lista de pontos do signal
            
        Returns:
            Lista de valores de confidence
        """
        
        numeric_values = []
        for point in points:
            if isinstance(point.value, dict):
                confidence = point.value.get("confidence")
                if confidence is not None and isinstance(confidence, (int, float)):
                    numeric_values.append(float(confidence))
        
        return numeric_values
    
    def getCameraStatus(self) -> Dict[str, Any]:
        """
        Status específico do signal de câmera incluindo métricas detalhadas.
        
        Returns:
            Status detalhado com informações específicas de câmera
        """
        
        base_status = self.getStatus()
        
        # Calcular métricas específicas de câmera
        recent_points = self.getLatest(5)
        camera_metrics = self._calculateCameraMetrics(recent_points)
        
        camera_status = {
            **base_status,
            "cameraMetrics": camera_metrics,
            "lastValues": {
                "ear": self.lastEar,
                "blinkRate": self.lastBlinkRate,
                "gazeVector": self.lastGazeVector,
                "consecutiveLowEar": self.consecutiveLowEarCount
            },
            "thresholds": {
                "detectionConfidence": self.detectionThreshold,
                "drowsinessBlinkRate": self.drowsinessBlinkThreshold,
                "hyperBlinkRate": self.hyperBlinkThreshold,
                "earBlink": self.earBlinkThreshold,
                "earDrowsy": self.earDrowsyThreshold,
                "gazeStability": self.gazeStabilityThreshold
            },
            "ranges": {
                "gaze": self.gazeNormalRange,
                "blinkRate": self.blinkRateNormalRange,
                "ear": self.earNormalRange
            },
            "config": {
                "expectedLandmarks": self.expectedLandmarksCount,
                "landmarksDimensions": self.landmarksDimensions,
                "samplingRate": self.samplingRate
            }
        }
        
        return camera_status
    
    def _calculateCameraMetrics(self, recent_points: List[SignalPoint]) -> Dict[str, Any]:
        """
        Calcula métricas específicas dos dados de câmera.
        
        Args:
            recent_points: Pontos recentes para análise
            
        Returns:
            Métricas detalhadas de qualidade e performance
        """
        
        if not recent_points:
            return {"available": False, "reason": "No recent data"}
        
        # Extrair dados dos pontos recentes
        confidences = []
        ears = []
        blink_rates = []
        gaze_magnitudes = []
        
        for point in recent_points:
            if isinstance(point.value, dict):
                data = point.value
                
                if "confidence" in data:
                    confidences.append(data["confidence"])
                
                if "ear" in data:
                    ears.append(data["ear"])
                
                if "blink_rate" in data:
                    blink_rates.append(data["blink_rate"])
                
                if "gaze_vector" in data:
                    gv = data["gaze_vector"]
                    if isinstance(gv, dict) and "dx" in gv and "dy" in gv:
                        magnitude = np.sqrt(gv["dx"]**2 + gv["dy"]**2)
                        gaze_magnitudes.append(magnitude)
        
        metrics = {
            "available": True,
            "sampleCount": len(recent_points),
            "qualityMetrics": {},
            "behaviorMetrics": {},
            "stabilityMetrics": {}
        }
        
        # Métricas de qualidade
        if confidences:
            metrics["qualityMetrics"] = {
                "averageConfidence": round(np.mean(confidences), 3),
                "minConfidence": round(np.min(confidences), 3),
                "maxConfidence": round(np.max(confidences), 3),
                "confidenceStability": round(1.0 - np.std(confidences), 3),
                "highQualityFrames": sum(1 for c in confidences if c >= 0.8),
                "lowQualityFrames": sum(1 for c in confidences if c < self.detectionThreshold)
            }
        
        # Métricas comportamentais
        if ears and blink_rates:
            metrics["behaviorMetrics"] = {
                "averageEar": round(np.mean(ears), 3),
                "averageBlinkRate": round(np.mean(blink_rates), 1),
                "minEar": round(np.min(ears), 3),
                "maxBlinkRate": round(np.max(blink_rates), 1),
                "drowsinessIndicators": sum(1 for e in ears if e < self.earDrowsyThreshold),
                "alertnessLevel": self._calculateAlertnessLevel(ears, blink_rates)
            }
        
        # Métricas de estabilidade
        if gaze_magnitudes:
            metrics["stabilityMetrics"] = {
                "averageGazeMagnitude": round(np.mean(gaze_magnitudes), 3),
                "gazeStability": round(1.0 - np.std(gaze_magnitudes), 3),
                "centeredGazeFrames": sum(1 for g in gaze_magnitudes if g <= 0.2),
                "distractedFrames": sum(1 for g in gaze_magnitudes if g > 0.7)
            }
        
        return metrics
    
    def _calculateAlertnessLevel(self, ears: List[float], blink_rates: List[float]) -> str:
        """
        Calcula nível de alerta baseado em EAR e blink rate.
        
        Args:
            ears: Lista de valores EAR
            blink_rates: Lista de taxas de piscadelas
            
        Returns:
            Nível de alerta ("alert", "normal", "drowsy", "critical")
        """
        
        if not ears or not blink_rates:
            return "unknown"
        
        avg_ear = np.mean(ears)
        avg_blink_rate = np.mean(blink_rates)
        
        # Lógica de classificação
        if avg_ear < 0.15 or avg_blink_rate < 5:
            return "critical"
        elif avg_ear < self.earDrowsyThreshold or avg_blink_rate < self.drowsinessBlinkThreshold:
            return "drowsy"
        elif avg_ear > 0.35 and self.blinkRateNormalRange[0] <= avg_blink_rate <= self.blinkRateNormalRange[1]:
            return "alert"
        else:
            return "normal"
    
    def reset(self) -> None:
        """Reset completo do signal de câmera"""
        
        super().reset()
        
        # Reset estado interno específico
        self.lastEar = None
        self.lastBlinkRate = None
        self.lastGazeVector = None
        self.recentEarValues.clear()
        self.consecutiveLowEarCount = 0
        
        self.logger.info("CameraSignal reset completed")