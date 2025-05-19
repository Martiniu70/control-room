from typing import Dict, List, Optional, TypeVar, Generic, TypedDict
import numpy as np

T = TypeVar("T", bound=TypedDict) # type: ignore

# Different types of expected data from sensors
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

        keys = [key for key in self._data[0].keys() if key != "timestamp"]
        values = {key: [] for key in keys}

        for point in self._data:
            for key in keys:
                values[key].append(point[key])

        return {key: float(np.mean(values[key])) for key in keys}
