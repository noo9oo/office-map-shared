"""A dedicated worksheet only. Never use snack-lab's sheet1 or GSHEET_ID."""
import copy
import json
import threading
import time
from datetime import datetime, timezone

from model import Journal, initial_request, validate_request

HEADER = ["event_id", "utc_time", "display_name", "changes_json"]
TAB = "office_map_events_v1"


class SharedStore:
    def __init__(self, sheet):
        self.sheet = sheet
        self.lock = threading.RLock()
        self.journal = None
        self.checked = 0.0

    def refresh(self, force=False):
        with self.lock:
            if not force and self.journal is not None and time.monotonic() - self.checked < 8:
                return self.journal
            rows = self.sheet.get_all_values()
            if not rows or rows[0] != HEADER:
                raise ValueError("사무실 맵 전용 시트의 제목 행이 올바르지 않습니다.")
            journal = Journal(rows[1:])
            if not journal.records:
                request = initial_request()
                self._append(request, "초기 등록")
                journal = Journal(self.sheet.get_all_values()[1:])
            self.journal = journal
            self.checked = time.monotonic()
            return journal

    def _append(self, request, actor):
        row = [request["id"], datetime.now(timezone.utc).isoformat(timespec="seconds"), actor,
               json.dumps(request["changes"], ensure_ascii=False, separators=(",", ":"))]
        self.sheet.append_row(row, value_input_option="RAW", insert_data_option="INSERT_ROWS", table_range="A:D")

    def snapshot(self):
        return self.refresh().snapshot()

    def commit(self, request, actor):
        validate_request(request)
        with self.lock:
            current = self.refresh(force=True)
            if request["id"] not in current.outcomes:
                # The durable row order, not this process lock, determines conflicts.
                # A lost HTTP response is safe to retry using the same event id.
                self._append(request, actor)
                current = self.refresh(force=True)
            return copy.deepcopy(current.outcomes[request["id"]])


def connect(service_account, spreadsheet_id):
    import gspread
    from google.oauth2.service_account import Credentials

    credentials = Credentials.from_service_account_info(dict(service_account), scopes=["https://www.googleapis.com/auth/spreadsheets"])
    client = gspread.authorize(credentials)
    book = client.open_by_key(spreadsheet_id)
    try:
        sheet = book.worksheet(TAB)
    except gspread.WorksheetNotFound:
        sheet = book.add_worksheet(TAB, rows=1000, cols=4)
        sheet.update(values=[HEADER], range_name="A1:D1", value_input_option="RAW")
    return SharedStore(sheet)
