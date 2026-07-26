from __future__ import annotations

from typing import Any

from src.core.config import get_settings
from src.schemas.sandbox import ToolExecutionResult

MAX_SEARCH_RESULTS = 15
SEARCH_PROVIDER_TAVILY = "tavily"
SEARCH_PROVIDER_EXA = "exa"
SEARCH_PROVIDER_SERPAPI = "serpapi"

WEB_SEARCH_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Search the web for up-to-date information, news, and general knowledge. Returns up to 15 results with titles, URLs, and descriptions.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query"
                }
            },
            "required": ["query"]
        }
    }
}


async def execute_web_search(*, arguments: dict[str, Any], **kwargs) -> ToolExecutionResult:
    query = arguments.get("query", "")
    if not query:
        return ToolExecutionResult(
            ok=False,
            error={"code": "missing_query", "message": "No search query provided."},
        )

    search_provider = kwargs.get("search_provider") or SEARCH_PROVIDER_TAVILY

    if search_provider == SEARCH_PROVIDER_EXA:
        return await _execute_exa_search(query, kwargs)
    if search_provider == SEARCH_PROVIDER_SERPAPI:
        return await _execute_serpapi_search(query, kwargs)
    return await _execute_tavily_search(query, kwargs)


async def _execute_tavily_search(query: str, kwargs: dict[str, Any]) -> ToolExecutionResult:
    api_key = kwargs.get("tavily_api_key") or get_settings().tavily_api_key
    if not api_key:
        return ToolExecutionResult(
            ok=False,
            error={"code": "missing_api_key", "message": "Tavily API key is not configured. Add it in Settings."},
        )

    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=api_key)
        response = client.search(query=query, max_results=MAX_SEARCH_RESULTS)
        raw_results = response.get("results", []) if isinstance(response, dict) else []

        formatted: list[dict[str, str]] = []
        for item in raw_results:
            formatted.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "Description": item.get("content", item.get("description", "")),
            })

        return ToolExecutionResult(
            ok=True,
            data={
                "query": query,
                "results": formatted,
                "result_count": len(formatted),
            },
        )
    except ImportError:
        return ToolExecutionResult(
            ok=False,
            error={"code": "missing_dependency", "message": "Tavily package is not installed. Run: pip install tavily-python"},
        )
    except Exception as exc:
        return ToolExecutionResult(
            ok=False,
            error={"code": "web_search_failed", "message": str(exc)},
        )


async def _execute_exa_search(query: str, kwargs: dict[str, Any]) -> ToolExecutionResult:
    api_key = kwargs.get("exa_api_key") or get_settings().exa_api_key
    if not api_key:
        return ToolExecutionResult(
            ok=False,
            error={"code": "missing_api_key", "message": "Exa API key is not configured. Add it in Settings."},
        )

    try:
        from exa_py import Exa
        client = Exa(api_key=api_key)
        response = client.search(
            query=query,
            num_results=MAX_SEARCH_RESULTS,
            contents={"highlights": True},
        )
        raw_results = response.results if hasattr(response, "results") else []

        formatted: list[dict[str, str]] = []
        for item in raw_results:
            formatted.append({
                "title": getattr(item, "title", ""),
                "url": getattr(item, "url", ""),
                "Description": " ".join(item.highlights) if hasattr(item, "highlights") and item.highlights else getattr(item, "text", ""),
            })

        return ToolExecutionResult(
            ok=True,
            data={
                "query": query,
                "results": formatted,
                "result_count": len(formatted),
            },
        )
    except ImportError:
        return ToolExecutionResult(
            ok=False,
            error={"code": "missing_dependency", "message": "Exa package is not installed. Run: pip install exa-py"},
        )
    except Exception as exc:
        return ToolExecutionResult(
            ok=False,
            error={"code": "web_search_failed", "message": str(exc)},
        )


async def _execute_serpapi_search(query: str, kwargs: dict[str, Any]) -> ToolExecutionResult:
    api_key = kwargs.get("serpapi_api_key") or get_settings().serpapi_api_key
    if not api_key:
        return ToolExecutionResult(
            ok=False,
            error={"code": "missing_api_key", "message": "SerpAPI API key is not configured. Add it in Settings."},
        )

    try:
        from serpapi import GoogleSearch

        params = {
            "q": query,
            "api_key": api_key,
            "num": MAX_SEARCH_RESULTS,
            "engine": "google",
        }
        search = GoogleSearch(params)
        response = search.get_dict()
        raw_results = response.get("organic_results", [])

        formatted: list[dict[str, str]] = []
        for item in raw_results:
            formatted.append({
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "Description": item.get("snippet", ""),
            })

        return ToolExecutionResult(
            ok=True,
            data={
                "query": query,
                "results": formatted,
                "result_count": len(formatted),
            },
        )
    except ImportError:
        return ToolExecutionResult(
            ok=False,
            error={"code": "missing_dependency", "message": "SerpAPI package is not installed. Run: pip install google-search-results"},
        )
    except Exception as exc:
        return ToolExecutionResult(
            ok=False,
            error={"code": "web_search_failed", "message": str(exc)},
        )
