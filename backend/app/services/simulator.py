from app.core.graph import Graph, SignalPoint
from app.core.graphDataGenerator import GraphDataGenerator

ecg_graph = Graph[SignalPoint]()
eeg_graph = Graph[SignalPoint]()
ppg_graph = Graph[SignalPoint]()

ecg_gen = GraphDataGenerator(SignalPoint, {"value": (60, 100)})
eeg_gen = GraphDataGenerator(SignalPoint, {"value": (0.3, 1.2)})
ppg_gen = GraphDataGenerator(SignalPoint, {"value": (0.8, 1.5)})

def generate_all():
    ecg_graph.addValue(ecg_gen.generate())
    eeg_graph.addValue(eeg_gen.generate())
    ppg_graph.addValue(ppg_gen.generate())

def get_latest_data():
    return {
        "ecg": ecg_graph.getLastValue(),
        "eeg": eeg_graph.getLastValue(),
        "ppg": ppg_graph.getLastValue(),
    }
