from typing import List, Optional, TypeVar, Generic, TypedDict

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

    def add_value(self, value: T) -> None:
        self._data.append(value)

    def get_last_value(self) -> Optional[T]:
        return self._data[-1] if self._data else None

    def get_data(self) -> List[T]:
        return self._data

    def clear(self) -> None:
        self._data.clear()
