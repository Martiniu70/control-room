"""
Control Room Core
"""

from .config import settings
from .events import eventManager
from .exceptions import (
    ControlRoomException,
    SignalValidationError,
    ZeroMQError,
    WebSocketError,
    TopicValidationError
)

__all__ = [
    "settings",
    "eventManager", 
    "ControlRoomException",
    "SignalValidationError",
    "ZeroMQError",
    "WebSocketError",
    "TopicValidationError"
]

import logging
logging.basicConfig(level = settings.logLevel) # Por enquanto debug 
logger = logging.getLogger(__name__)
logger.info("Control Room - Automotive Simulator")