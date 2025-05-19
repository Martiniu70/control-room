from typing import TypeVar, Generic, TypedDict, Dict, Tuple, Any, Optional, get_type_hints
import random
import time

T = TypeVar("T", bound=TypedDict)  # type: ignore

class GraphDataGenerator(Generic[T]):

    def __init__(self, model: type[T], valueRanges: Optional[Dict[str, Tuple[float, float]]] = None, mode: str = "random"):
        self._timestamp = time.time()
        self.model = model
        self.valueRanges = self._inferRanges(valueRanges or {})
        self.mode = mode
        # Para smooth mode, guardamos valores anteriores para cada campo
        self._previous_values: Dict[str, float] = {
            key: (minVal + maxVal) / 2 for key, ((minVal, maxVal), _) in self.valueRanges.items()
        }
        self._abrupt_last_extreme: Dict[str, float] = {}

    def _inferRanges(self, customRanges: Dict[str, Tuple[float, float]]) -> Dict[str, Tuple[Tuple[float, float], type]]:
        result: Dict[str, Tuple[Tuple[float, float], type]] = {}
        hints = get_type_hints(self.model)
        for field, fieldType in hints.items():
            if field == "timestamp":
                continue
            if field in customRanges:
                result[field] = (customRanges[field], fieldType)
            elif fieldType == int:
                result[field] = ((0, 1), int)
            else:
                result[field] = ((0.0, 1.0), float)
        return result

    def generate(self) -> T:
        self._timestamp += 1.0
        data: Dict[str, Any] = {"timestamp": self._timestamp}

        for key, ((minVal, maxVal), valueType) in self.valueRanges.items():
            if self.mode == "random":
                if valueType == int:
                    data[key] = random.randint(int(minVal), int(maxVal))
                else:
                    data[key] = random.uniform(minVal, maxVal)

            elif self.mode == "smooth":
                prev = self._previous_values.get(key, (minVal + maxVal) / 2)
                delta_range = (maxVal - minVal) * 0.05
                delta = random.uniform(-delta_range, delta_range)
                new_val = prev + delta
                new_val = max(minVal, min(maxVal, new_val))
                if valueType == int:
                    new_val = int(round(new_val))
                data[key] = new_val
                self._previous_values[key] = new_val

            elif self.mode == "abrupt":
                # Alterna entre min e max baseado no último extremo usado
                last = self._abrupt_last_extreme.get(key, maxVal)  # Começa no max para ir ao min no 1º generate
                new_base = minVal if last == maxVal else maxVal

                # Pequena variação perto do extremo (até 10% da faixa)
                delta_range = (maxVal - minVal) * 0.1
                delta = random.uniform(-delta_range, delta_range)
                new_val = new_base + delta
                new_val = max(minVal, min(maxVal, new_val))
                if valueType == int:
                    new_val = int(round(new_val))
                data[key] = new_val
                self._abrupt_last_extreme[key] = new_base

            else:
                raise ValueError(f"Unknown mode: {self.mode}")

        return data  # type: ignore
