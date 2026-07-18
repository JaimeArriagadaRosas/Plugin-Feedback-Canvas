import sys
import time
import threading
import itertools


class Spinner:
    def __init__(self, message="Procesando..."):
        self.spinner = itertools.cycle(['|', '/', '-', '\\'])
        self.message = message
        self.suffix = ""
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._spin)

    def start(self):
        self.thread.start()

    def set_suffix(self, text):
        self.suffix = text

    def pause(self):
        self.stop_event.set()
        self.thread.join()
        sys.stdout.write('\r\033[K')
        sys.stdout.flush()
        self.stop_event.clear()
        self.thread = threading.Thread(target=self._spin)

    def resume(self):
        self.thread.start()

    def stop(self, final_text=""):
        self.stop_event.set()
        self.thread.join()
        sys.stdout.write('\r\033[K' + final_text + '\n')
        sys.stdout.flush()

    def _spin(self):
        import shutil
        while not self.stop_event.is_set():
            term_width = shutil.get_terminal_size().columns or 80
            text = f"{self.message}{self.suffix}"
            max_len = term_width - 3
            if len(text) > max_len:
                text = text[:max_len-3] + "..."
            sys.stdout.write(f'\r\033[K\033[36m{next(self.spinner)}\033[0m {text}')
            sys.stdout.flush()
            time.sleep(0.1)
