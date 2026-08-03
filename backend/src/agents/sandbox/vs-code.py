"""Browser VS Code (code-server) provisioning for sandboxes.

This module writes the ``vs-code.sh`` bootstrap script into the sandbox at
``/home/user/vs-code.sh`` and executes it with ``bash vs-code.sh``. The script
installs code-server (if missing), writes its config, and starts it on port
8080 inside the sandbox.

Design guarantees:

- The launch runs as a fire-and-forget background process managed by the
  sandbox daemon (envd). Once started, code-server keeps running no matter
  what happens to the agent loop, the SSE stream, or this backend process.
- The launcher never raises: failures are logged and returned as structured
  results, so code-server provisioning can never block or break the agent.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from src.agents.sandbox.base import SandboxAdapter, SandboxContext

logger = logging.getLogger(__name__)

VS_CODE_PORT = 8080
VS_CODE_WORKSPACE_FOLDER = "/home/user/"
VS_CODE_SCRIPT_NAME = "vs-code.sh"
VS_CODE_SCRIPT_PATH = f"/home/user/{VS_CODE_SCRIPT_NAME}"
VS_CODE_RUN_COMMAND = f"cd /home/user && bash {VS_CODE_SCRIPT_NAME}"
NOVITA_SANDBOX_DOMAIN = "us-phx-1.sandbox.novita.ai"

# Number of times the launcher retries on transient sandbox errors before
# giving up. Transient envd/stream hiccups must not permanently prevent
# code-server from starting.
_LAUNCH_ATTEMPTS = 3
_LAUNCH_RETRY_DELAY_SECONDS = 2.0

# Content of the shell script executed inside the sandbox. Written verbatim
# to ``/home/user/vs-code.sh``.
VS_CODE_SCRIPT = """#!/bin/bash


PORT=8080
AUTH="none"   # change to "none" if you don't want password
echo "🚀 Starting code-server setup..."
if ! command -v code-server &> /dev/null; then
    echo "📦 Installing code-server..."
    curl -fsSL https://code-server.dev/install.sh | sh
fi
CONFIG_DIR="$HOME/.config/code-server"
CONFIG_FILE="$CONFIG_DIR/config.yaml"
mkdir -p $CONFIG_DIR
if [ ! -f "$CONFIG_FILE" ]; then
    echo "⚙️ Creating default config..."
    cat <<EOF > $CONFIG_FILE
bind-addr: 0.0.0.0:$PORT
auth: $AUTH
password: 123456
cert: false
EOF
fi
echo "🔥 Running code-server on http://localhost:$PORT"
code-server ~
"""


def build_code_server_url(sandbox_id: str) -> str:
    """Build the public browser URL of the sandbox's code-server instance."""
    return (
        f"https://{VS_CODE_PORT}-{sandbox_id}.{NOVITA_SANDBOX_DOMAIN}"
        f"/?folder={VS_CODE_WORKSPACE_FOLDER}"
    )


async def start_code_server(
    adapter: SandboxAdapter,
    context: SandboxContext,
) -> dict[str, Any]:
    """Provision and launch code-server inside the sandbox.

    Writes ``/home/user/vs-code.sh`` and runs ``bash vs-code.sh`` as a
    detached background process. After a successful launch the SDK detaches
    from the process stream without killing it, so code-server keeps running
    inside the sandbox independently of this backend, the agent loop, and the
    SSE stream.

    This coroutine never raises. It retries transient failures a few times and
    always returns a structured result describing the outcome.
    """
    url = build_code_server_url(context.sandbox_id)
    last_error: Optional[str] = None

    for attempt in range(1, _LAUNCH_ATTEMPTS + 1):
        try:
            # Step 1: create the bootstrap script inside the sandbox.
            await adapter.write_file(context, VS_CODE_SCRIPT_PATH, VS_CODE_SCRIPT)

            # Step 2: run it in the background. ``timeout=0`` disables the
            # connection timeout so the launch is never cut short; the process
            # itself is owned by the sandbox daemon, not by this connection.
            launch = await adapter.run_command(
                context,
                VS_CODE_RUN_COMMAND,
                timeout=0,
                wait_for_output=False,
            )

            pid = launch.get("pid")
            handle = launch.get("_handle")

            # Step 3: detach from the event stream. Disconnecting stops the SDK
            # from consuming output but does NOT kill the process; envd keeps
            # code-server alive for the sandbox's lifetime.
            if handle is not None:
                try:
                    await handle.disconnect()
                except Exception:
                    logger.debug(
                        "code-server stream detach failed (sandbox=%s, pid=%s)",
                        context.sandbox_id,
                        pid,
                        exc_info=True,
                    )

            context.background_handles["vs-code"] = {
                "pid": pid,
                "detached": True,
                "url": url,
            }
            logger.info(
                "code-server launched in sandbox %s (pid=%s, attempt=%s): %s",
                context.sandbox_id,
                pid,
                attempt,
                url,
            )
            return {"ok": True, "pid": pid, "url": url, "attempt": attempt}

        except asyncio.CancelledError:
            # Propagate cancellation untouched so shutdown stays clean.
            raise
        except Exception as exc:
            last_error = str(exc)
            logger.warning(
                "code-server launch attempt %s/%s failed for sandbox %s: %s",
                attempt,
                _LAUNCH_ATTEMPTS,
                context.sandbox_id,
                exc,
            )
            if attempt < _LAUNCH_ATTEMPTS:
                await asyncio.sleep(_LAUNCH_RETRY_DELAY_SECONDS)

    logger.error(
        "code-server failed to start in sandbox %s after %s attempts: %s",
        context.sandbox_id,
        _LAUNCH_ATTEMPTS,
        last_error,
    )
    return {"ok": False, "url": url, "error": last_error}
