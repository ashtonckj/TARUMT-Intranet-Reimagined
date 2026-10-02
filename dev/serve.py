# Serves the project folder for the dev previews with caching off, so an edited
# stylesheet always shows on the next reload.
#
#   python dev/serve.py            (from the project folder)

import http.server
import os

PORT = int(os.environ.get("PORT", "8765"))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
print(f"http://localhost:{PORT}/dev/preview/")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler).serve_forever()
