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