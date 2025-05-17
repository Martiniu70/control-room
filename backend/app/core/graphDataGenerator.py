from typing import TypeVar, Generic, TypedDict, Dict, Tuple, Any, Optional, get_type_hints
import random
import time

T = TypeVar("T", bound=TypedDict)

# Function to generate data to a given graphic type, timestamps will be incremented in a basic way
class GraphDataGenerator(Generic[T]):
    
    def __init__(self, model: type[T], valueRanges: Optional[Dict[str, Tuple[float, float]]] = None):
        self._timestamp = time.time()
        self.model = model
        self.valueRanges = self._inferRanges(valueRanges or {})

    def _inferRanges(self, customRanges: Dict[str, Tuple[float, float]]) -> Dict[str, Tuple[float, float]]:
        result: Dict[str, Tuple[float, float]] = {}
        hints = get_type_hints(self.model)
        for field, fieldType in hints.items():
            if field == "timestamp":
                continue
            if field in customRanges:
                result[field] = customRanges[field]
            elif fieldType == int:
                result[field] = (0, 1)
            else:
                result[field] = (0.0, 1.0)
        return result

    def generate(self) -> T:
        self._timestamp += 1.0
        data: Dict[str, Any] = {"timestamp": self._timestamp}
        for key, (minVal, maxVal) in self.valueRanges.items():
            data[key] = random.uniform(minVal, maxVal)
        return data  # type: ignore
