from app.core.graph import Graph, SignalPoint, SignalInt, SignalMulti
from app.core.graphDataGenerator import GraphDataGenerator

def testar_signal_point():
    print("=== SignalPoint ===")
    graph = Graph[SignalPoint]()
    generator = GraphDataGenerator(SignalPoint, {"value": (60, 100)})

    for _ in range(10):
        point = generator.generate()
        graph.addValue(point)

    print("Último valor:", graph.getLastValue())
    print("Média:", graph.getAverages())
    print()

def testar_signal_int():
    print("=== SignalInt ===")
    graph = Graph[SignalInt]()
    generator = GraphDataGenerator(SignalInt, {"value": (0, 10)})

    for _ in range(10):
        point = generator.generate()
        graph.addValue(point)

    print("Último valor:", graph.getLastValue())
    print("Média:", graph.getAverages())
    print()

def testar_signal_multi():
    print("=== SignalMulti ===")
    graph = Graph[SignalMulti]()
    generator = GraphDataGenerator(SignalMulti, {"value1": (1.0, 2.0), "value2": (5.0, 10.0)})

    for _ in range(10):
        point = generator.generate()
        graph.addValue(point)

    print("Último valor:", graph.getLastValue())
    print("Média:", graph.getAverages())
    print()


if __name__ == "__main__":
    testar_signal_point()
    testar_signal_int()
    testar_signal_multi()
