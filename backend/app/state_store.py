import asyncio
import copy
from typing import Any, Callable, Dict, Optional

from .models import UserState


def _deep_merge(dest: Dict[str, Any], src: Dict[str, Any]) -> Dict[str, Any]:
    for key, value in src.items():
        if key in dest and isinstance(dest[key], dict) and isinstance(value, dict):
            dest[key] = _deep_merge(dest[key], value)
        else:
            dest[key] = copy.deepcopy(value)
    return dest


class StateStore:
    """In-memory state store keyed by user id."""

    def __init__(
        self,
        initial_data: Optional[Dict[str, Any]] = None,
        initial_state_factory: Optional[Callable[[], Dict[str, Any]]] = None,
    ) -> None:
        self._states: Dict[str, UserState] = {}
        self._lock = asyncio.Lock()
        self._initial_data = copy.deepcopy(initial_data) if initial_data else None
        self._initial_state_factory = initial_state_factory

    def _new_state(self) -> UserState:
        if self._initial_state_factory is not None:
            return UserState(data=copy.deepcopy(self._initial_state_factory()))
        if self._initial_data is None:
            return UserState()
        return UserState(data=copy.deepcopy(self._initial_data))

    async def get_state(self, user_id: str) -> UserState:
        async with self._lock:
            state = self._states.get(user_id)
            if state is None:
                state = self._new_state()
                self._states[user_id] = state
            return state

    async def replace_state(self, user_id: str, new_state: Dict[str, Any]) -> UserState:
        async with self._lock:
            state = UserState(**new_state)
            self._states[user_id] = state
            return state

    async def patch_state(self, user_id: str, patch: Dict[str, Any], note: Optional[str]) -> UserState:
        async with self._lock:
            state = self._states.get(user_id, UserState())
            updated_data = _deep_merge(copy.deepcopy(state.data), patch)
            state.data = updated_data
            if note is not None:
                state.note = note
            state.touch()
            self._states[user_id] = state
            return state

    async def reset_state(self, user_id: str) -> UserState:
        async with self._lock:
            state = self._new_state()
            self._states[user_id] = state
            return state

    async def delete_state(self, user_id: str) -> None:
        async with self._lock:
            self._states.pop(user_id, None)
