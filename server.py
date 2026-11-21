import http.server
import os
import socketserver
import threading
import webbrowser

PORT = 8090
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class UnityWebGLHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        path = self.path.split("?")[0].lower()
        if path.endswith(".br"):
            self.send_header("Content-Encoding", "br")
        super().end_headers()

    def guess_type(self, path):
        clean_path = path.split("?")[0].lower()
        if clean_path.endswith(".wasm.br") or clean_path.endswith(".wasm"):
            return "application/wasm"
        if clean_path.endswith(".js.br") or clean_path.endswith(".js"):
            return "application/javascript"
        if clean_path.endswith(".data.br") or clean_path.endswith(".data"):
            return "application/octet-stream"
        return super().guess_type(path)

    def log_message(self, format, *args):
        # Giữ console sạch sẽ
        pass

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), UnityWebGLHandler) as httpd:
        url = f"http://127.0.0.1:{PORT}/"
        print(f"🎮 Game My Perfect Hotel Offline dang chay tai: {url}")
        print("🛑 Nhan Ctrl+C hoac dong cua so nay de tat game.")
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDa tat server game.")
