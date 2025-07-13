"""
Signal implementations
"""

from .cardiacSignal import CardiacSignal
from .eegSignal import EEGSignal
from .sensorSignal import SensorsSignal

__all__ = ["CardiacSignal", "EEGSignal", "SensorsSignal"]