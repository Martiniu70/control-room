"""
Utility comum para testes
"""

import asyncio
import logging
from typing import List, Dict, Any
from datetime import datetime

class EventLogger:
    """Logger de eventos para testes"""
    
    def __init__(self, name: str):
        self.name = name
        self.events: List[Dict[str, Any]] = []
        self.logger = logging.getLogger(f"TestEventLogger.{name}")
    
    async def onEvent(self, event):
        """Callback para eventos"""
        eventData = {
            "name": event.name,
            "data": event.data,
            "timestamp": event.timestamp.isoformat()
        }
        
        self.events.append(eventData)
        self.logger.info(f"Event: {event.name} - {event.data}")
    
    def getEventCount(self, eventName: str = None) -> int:
        """Conta eventos"""
        if eventName:
            return len([event for event in self.events if event["name"] == eventName])
        return len(self.events)
    
    def clear(self):
        """Limpa histórico"""
        self.events.clear()
        self.logger.info("Event history cleared")

class TestRunner:
    """Runner base para testes"""
    
    def __init__(self, testName: str):
        self.testName = testName
        self.logger = logging.getLogger(f"TestRunner.{testName}")
        self.results: List[Dict[str, Any]] = []
    
    def startTest(self, description: str):
        """Inicia um teste"""
        self.logger.info(f"Starting: {description}")
        print(f"\nDescription: {description}")
    
    def assert_equal(self, actual, expected, message: str = ""):
        """Assertion simples"""
        if actual == expected:
            self.logger.info(f"{message}: {actual} == {expected}")
            print(f"{message}: PASS")
            self.results.append({"test": message, "status": "PASS"})
        else:
            self.logger.error(f"{message}: {actual} != {expected}")
            print(f"{message}: FAIL - Expected {expected}, got {actual}")
            self.results.append({"test": message, "status": "FAIL"})
    
    def assert_true(self, condition: bool, message: str = ""):
        """Assertion boolean"""
        if condition:
            self.logger.info(f"{message}: True")
            print(f"{message}: PASS")
            self.results.append({"test": message, "status": "PASS"})
        else:
            self.logger.error(f"{message}: False")
            print(f"{message}: FAIL")
            self.results.append({"test": message, "status": "FAIL"})
    
    def summary(self):
        """Resumo dos testes"""
        passed = len([r for r in self.results if r["status"] == "PASS"])
        failed = len([r for r in self.results if r["status"] == "FAIL"])
        total = len(self.results)
        
        print(f"\n{self.testName} Summary:")
        print(f"   Total: {total}")
        print(f"   Passed: {passed}")
        print(f"   Failed: {failed}")
        print(f"   Success Rate: {(passed/total)*100:.1f}%" if total > 0 else "   No tests run")
        
        return failed == 0  # True se todos passaram