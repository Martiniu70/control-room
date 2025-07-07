"""
Exceções 

Classe simples para ter debugging de erros mais clara , obrigando a especifcar para cada tipo de erro
certos detalhes dependendo do casso
"""

from typing import Dict, Any

class ControlRoomException(Exception):
    """Exceção base"""
    
    def __init__(self, message: str, details: Dict[str, Any] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

class SignalValidationError(ControlRoomException):
    """Erro de validação de sinal"""
    
    def __init__(self, signalType: str, value: Any, reason: str = None):
        message = f"Invalid {signalType} signal: {value}"
        if reason:
            message += f" - {reason}"
        
        super().__init__(
            message=message,
            details={
                "signalType": signalType,
                "value": value,
                "reason": reason
            }
        )

class ZeroMQError(ControlRoomException):
    """Erro ZeroMQ"""
    
    def __init__(self, operation: str, reason: str):
        message = f"ZeroMQ {operation} failed: {reason}"
        super().__init__(
            message=message,
            details={"operation": operation, "reason": reason}
        )

class WebSocketError(ControlRoomException):
    """Erro WebSocket"""
    
    def __init__(self, reason: str):
        super().__init__(
            message=f"WebSocket error: {reason}",
            details={"reason": reason}
        )

class ZeroMQProcessingError(ControlRoomException):
    """Erro no processamento de dados ZeroMQ"""
    
    def __init__(self, topic: str, operation: str, reason: str, rawData: Any = None):
        message = f"ZeroMQ processing failed for topic '{topic}' during {operation}: {reason}"
        super().__init__(
            message=message,
            details={
                "topic": topic,
                "operation": operation,
                "reason": reason,
                "rawData": str(rawData)[:200] if rawData else None  # Limitar tamanho
            }
        )

class TopicValidationError(ControlRoomException):
    """Erro de validação específica de tópico"""
    
    def __init__(self, topic: str, field: str, value: Any, expectedRange: tuple = None):
        if expectedRange:
            message = f"Invalid {field} for topic '{topic}': {value} (expected {expectedRange})"
        else:
            message = f"Invalid {field} for topic '{topic}': {value}"
        
        super().__init__(
            message=message,
            details={
                "topic": topic,
                "field": field,
                "value": value,
                "expectedRange": expectedRange
            }
        )

class UnknownTopicError(ControlRoomException):
    """Erro para tópico não reconhecido"""
    
    def __init__(self, topic: str, availableTopics: list[str] = None):
        message = f"Unknown topic: '{topic}'"
        if availableTopics:
            message += f". Available topics: {availableTopics}"
        
        super().__init__(
            message=message,
            details={
                "topic": topic,
                "availableTopics": availableTopics
            }
        )