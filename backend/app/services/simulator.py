from app.core.graph import Graph, SignalPoint
from app.core.graphDataGenerator import GraphDataGenerator

ecgGraph = Graph[SignalPoint]()
eegGraph = Graph[SignalPoint]()
ppgGraph = Graph[SignalPoint]()

ecgGen = GraphDataGenerator(SignalPoint, {"value": (60, 100)}, mode="smooth")
eegGen = GraphDataGenerator(SignalPoint, {"value": (0.3, 1.2)}, mode="random")  
ppgGen = GraphDataGenerator(SignalPoint, {"value": (0.8, 1.5)}, mode="abrupt")

def generateAll():
    ecgGraph.addValue(ecgGen.generate())
    eegGraph.addValue(eegGen.generate())
    ppgGraph.addValue(ppgGen.generate())

def getLatestData():
    return {
        "ecg": ecgGraph.getLastValue(),
        "eeg": eegGraph.getLastValue(),
        "ppg": ppgGraph.getLastValue(),
    }
