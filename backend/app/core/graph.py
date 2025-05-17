from typing import Dict, List, Optional, TypeVar, Generic, TypedDict
import numpy as np

T = TypeVar("T", bound=TypedDict)

# Diferentes tipos esperado para cada ponto
class SignalPoint(TypedDict):
    timestamp: float
    value: float

class SignalInt(TypedDict):
    timestamp: float
    value: int

class SignalMulti(TypedDict):
    timestamp: float
    value1: float
    value2: float


class Graph(Generic[T]):
    def __init__(self):
        self._data: List[T] = []

    def addValue(self, value: T) -> None:
        self._data.append(value)

    def getLastValue(self) -> Optional[T]:
        return self._data[-1] if self._data else None

    def getData(self) -> List[T]:
        return self._data

    def clear(self) -> None:
        self._data.clear()

    def getAverages(self) -> Dict[str, float]:
        if not self._data:
            return {}

        keys = [k for k in self._data[0].keys() if k != "timestamp"]
        values = {k: [] for k in keys}

        for point in self._data:
            for k in keys:
                values[k].append(point[k])

        return {k: float(np.mean(values[k])) for k in keys}
