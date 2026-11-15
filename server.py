"""
juxtacrop local server.

Serves the public website at ``/``, the interactive MVP at ``/demo/``, and
proxies the SRTM elevation API (OpenTopoData), which does not send CORS headers
and therefore can't be called from the browser.

Usage:  python server.py [port]      (default port 8000)
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
SRTM_URL = "https://api.opentopodata.org/v1/{dataset}?locations={locations}"
_cache = {}
_last_call = [0.0]  # OpenTopoData public API allows ~1 request/second


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, request_path):
        """Map public URLs to either the website or the MVP directory."""
        url_path = urllib.parse.urlparse(request_path).path
        decoded_path = urllib.parse.unquote(url_path)
        if decoded_path == "/demo" or decoded_path.startswith("/demo/"):
            base = ROOT
            relative = decoded_path.removeprefix("/demo").lstrip("/")
        else:
            base = WEB_ROOT
            relative = decoded_path.lstrip("/")

        parts = relative.replace("\\", "/").split("/")
        if ".." in parts:
            return str(WEB_ROOT / ".not-found")

        target = base
        for part in parts:
            if part not in ("", "."):
                target /= part
        return str(target)

    def do_GET(self):
        if self.path.startswith("/api/srtm"):
            return self.srtm()
        return super().do_GET()

    def srtm(self):
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        locations = params.get("locations", [""])[0]
        dataset = params.get("dataset", ["srtm30m"])[0]
        if dataset not in ("srtm30m", "srtm90m") or not locations or locations.count("|") > 99:
            return self.send_json(400, {"error": "Pass up to 100 'lat,lon' pairs separated by '|'."})
        key = (dataset, locations)
        if key not in _cache:
            wait = 1.05 - (time.time() - _last_call[0])
            if wait > 0:
                time.sleep(wait)
            url = SRTM_URL.format(dataset=dataset, locations=urllib.parse.quote(locations, safe=",|.-"))
            try:
                with urllib.request.urlopen(url, timeout=30) as r:
                    _cache[key] = json.loads(r.read().decode("utf-8"))
            except Exception as exc:  # network error, rate limit, etc.
                return self.send_json(502, {"error": f"SRTM request failed: {exc}"})
            finally:
                _last_call[0] = time.time()
        return self.send_json(200, _cache[key])

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(ROOT)))
    print(f"juxtacrop website: http://localhost:{port}/")
    print(f"juxtacrop demo:    http://localhost:{port}/demo/")
    server.serve_forever()
