"""
Context Manager for AutoGenesis Agent.
Manages conversation context across multiple tool calls and skills.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from datetime import datetime
import logging
import uuid


logger = logging.getLogger(__name__)


@dataclass
class ToolCallRecord:
    """Record of a single tool call."""
    tool_name: str
    arguments: Dict[str, Any]
    result: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
    step: str = ""
    scenario: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool_name": self.tool_name,
            "arguments": self.arguments,
            "result": self.result,
            "timestamp": self.timestamp.isoformat(),
            "step": self.step,
            "scenario": self.scenario,
        }


@dataclass
class SessionContext:
    """Context for a single testing session."""
    session_id: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    actions: List[ToolCallRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    feature_file: Optional[str] = None
    current_scenario: Optional[str] = None
    gen_code_id: Optional[str] = None

    def add_action(self, action: ToolCallRecord) -> None:
        """Add an action to the session history."""
        self.actions.append(action)
        logger.debug(f"Session {self.session_id}: Added action {action.tool_name}")

    def get_recent_actions(self, count: int = 10) -> List[ToolCallRecord]:
        """Get the most recent actions."""
        return self.actions[-count:] if self.actions else []

    def get_actions_for_scenario(self, scenario: str) -> List[ToolCallRecord]:
        """Get all actions for a specific scenario."""
        return [a for a in self.actions if a.scenario == scenario]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "metadata": self.metadata,
            "actions": [a.to_dict() for a in self.actions],
            "created_at": self.created_at.isoformat(),
            "feature_file": self.feature_file,
            "current_scenario": self.current_scenario,
            "gen_code_id": self.gen_code_id,
        }


class ContextManager:
    """
    Manages conversation context across multiple tool calls and skills.

    Enables the agent to:
    - Remember previous actions in a test scenario
    - Track state across skills
    - Maintain BDD test generation context
    - Support multi-turn conversations
    """

    def __init__(self):
        self._sessions: Dict[str, SessionContext] = {}

    def create_session(
        self,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> SessionContext:
        """
        Create a new conversation session.

        Args:
            session_id: Optional session ID (auto-generated if not provided)
            metadata: Optional session metadata

        Returns:
            The created SessionContext
        """
        if session_id is None:
            session_id = str(uuid.uuid4())

        session = SessionContext(
            session_id=session_id,
            metadata=metadata or {}
        )
        self._sessions[session_id] = session
        logger.info(f"Created session: {session_id}")
        return session

    def get_session(self, session_id: str) -> Optional[SessionContext]:
        """Get a session by ID."""
        return self._sessions.get(session_id)

    def get_or_create_session(
        self,
        session_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> SessionContext:
        """Get existing session or create new one."""
        if session_id in self._sessions:
            return self._sessions[session_id]
        return self.create_session(session_id, metadata)

    def add_to_context(
        self,
        session_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
        result: Dict[str, Any],
        step: str = "",
        scenario: str = ""
    ) -> None:
        """
        Add an action to the session context.

        Args:
            session_id: Session to add action to
            tool_name: Name of the tool that was called
            arguments: Tool arguments
            result: Tool result
            step: BDD step text
            scenario: Scenario name
        """
        session = self._sessions.get(session_id)
        if session is None:
            logger.warning(f"Session not found: {session_id}")
            return

        record = ToolCallRecord(
            tool_name=tool_name,
            arguments=arguments,
            result=result,
            step=step,
            scenario=scenario,
        )
        session.add_action(record)

    def get_context(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve all actions in a session.

        Args:
            session_id: Session ID

        Returns:
            List of action dictionaries
        """
        session = self._sessions.get(session_id)
        if session is None:
            return []
        return [a.to_dict() for a in session.actions]

    def set_gen_code_id(self, session_id: str, gen_code_id: str) -> None:
        """Set the code generation ID for a session."""
        session = self._sessions.get(session_id)
        if session:
            session.gen_code_id = gen_code_id

    def set_feature_file(self, session_id: str, feature_file: str) -> None:
        """Set the feature file for a session."""
        session = self._sessions.get(session_id)
        if session:
            session.feature_file = feature_file

    def set_current_scenario(self, session_id: str, scenario: str) -> None:
        """Set the current scenario for a session."""
        session = self._sessions.get(session_id)
        if session:
            session.current_scenario = scenario

    def close_session(self, session_id: str) -> Optional[SessionContext]:
        """
        Close and remove a session.

        Args:
            session_id: Session to close

        Returns:
            The closed session or None if not found
        """
        session = self._sessions.pop(session_id, None)
        if session:
            logger.info(f"Closed session: {session_id}")
        return session

    def get_all_sessions(self) -> Dict[str, SessionContext]:
        """Get all active sessions."""
        return self._sessions.copy()

    def clear_all_sessions(self) -> None:
        """Clear all sessions."""
        self._sessions.clear()
        logger.info("Cleared all sessions")
