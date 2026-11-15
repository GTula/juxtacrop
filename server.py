"""
juxtacrop local preview server.

The whole site is static and lives in ``web/``: the public website at ``/`` and
the interactive prototype at ``/demo/``. Every data source is called straight
from the browser, so any static host (GitHub Pages, Netlify, Vercel...) can
publish ``web/`` as is. This script only serves it locally.

Usage:  python server.py [port]      (default port 8000)
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parent / "web"


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".mjs": "text/javascript", ".vtt": "text/vtt"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(WEB_ROOT)))
    print(f"juxtacrop website: http://localhost:{port}/")
    print(f"juxtacrop demo:    http://localhost:{port}/demo/")
    server.serve_forever()
