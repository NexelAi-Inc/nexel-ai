from __future__ import annotations

from uuid import uuid4

from chromadb import PersistentClient


class MemoryStore:
    def __init__(self, persist_directory: str) -> None:
        self.client = PersistentClient(path=persist_directory)
        self.collection = self.client.get_or_create_collection(name="agent_memory")

    def add(
        self,
        text: str,
        *,
        kind: str = "note",
        conversation_id: str | None = None,
        user_id: str | None = None,
    ) -> str:
        idx = str(uuid4())
        metadata = {"kind": kind}
        if conversation_id:
            metadata["conversation_id"] = conversation_id
        if user_id:
            metadata["user_id"] = user_id
        self.collection.add(documents=[text], ids=[idx], metadatas=[metadata])
        return idx

    def search(
        self,
        query: str,
        n_results: int = 5,
        *,
        kind: str | None = "note",
        user_id: str | None = None,
    ) -> list[str]:
        if self.collection.count() == 0:
            return []

        query_kwargs = {"query_texts": [query], "n_results": n_results}
        where_clauses: list[dict[str, str]] = []
        if kind is not None:
            where_clauses.append({"kind": kind})
        if user_id:
            where_clauses.append({"user_id": user_id})
        if len(where_clauses) == 1:
            query_kwargs["where"] = where_clauses[0]
        elif len(where_clauses) > 1:
            query_kwargs["where"] = {"$and": where_clauses}

        result = self.collection.query(**query_kwargs)
        return result.get("documents", [[]])[0]
