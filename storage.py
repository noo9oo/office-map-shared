"""Current state + last 100 outcomes, atomically guarded across app processes.

Every commit consumes an existing guard sheet ID and creates a new one in the
same Sheets batchUpdate as state/history. A competing stale deleteSheet fails
the whole batch. No read/check/write assumption or distributed lock timeout.
"""
import copy
import json
import secrets
import threading
import time
from datetime import datetime, timezone

from model import Journal, initial_request, validate_request

TAB = "office_map_events_v1"
HEADER = ["event_id", "utc_time", "display_name", "changes_json"]
STATE = "office_map_state_v2"
HISTORY = "office_map_history_v2"
GUARD = "office_map_guard_v2"
STATE_HEADER = ["key", "value_json", "revision"]
HISTORY_HEADER = ["event_id", "utc_time", "display_name", "change_count", "result_json"]
KEEP = 100


def dumps(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def sheet_id():
    return secrets.randbelow(2_000_000_000) + 1


def create_tab(title, identity, rows, cols, hidden=False):
    return {"addSheet": {"properties": {"sheetId": identity, "title": title,
            "hidden": hidden, "gridProperties": {"rowCount": rows, "columnCount": cols}}}}


def put_rows(identity, rows, columns):
    # An unbounded range clears trailing old values in the same atomic request.
    return {"updateCells": {"range": {"sheetId": identity}, "fields": "userEnteredValue",
            "rows": [{"values": [{"userEnteredValue": {"stringValue": str(v)}}
                                    for v in row]}
                     for row in rows]}}


def encode(journal, guard):
    state = [STATE_HEADER, ["__meta__", dumps({"format": 2, "count": journal.count,
                                              "guard": guard}), ""]]
    keys = list(journal.records) + [key for key in journal.revisions if key not in journal.records]
    for key in keys:
        state.append([key, dumps(journal.records.get(key)), journal.revisions[key]])
    history = [HISTORY_HEADER] + copy.deepcopy(journal.recent[-KEEP:])
    return state, history


def decode(state, history):
    if not state or state[0] != STATE_HEADER or len(state) < 2 or state[1][0] != "__meta__":
        raise ValueError("현재 자료 탭의 형식이 올바르지 않습니다. 초기화하지 마세요.")
    if not history or history[0] != HISTORY_HEADER or len(history) > KEEP + 1:
        raise ValueError("최근 기록 탭의 형식이 올바르지 않습니다.")
    meta = json.loads(state[1][1])
    if meta.get("format") != 2 or type(meta.get("count")) is not int or type(meta.get("guard")) is not int:
        raise ValueError("현재 자료의 버전 정보가 올바르지 않습니다.")
    journal = Journal()
    journal.count = meta["count"]
    journal.guard = meta["guard"]
    journal.recent = copy.deepcopy(history[1:])
    for row in state[2:]:
        if len(row) != 3 or row[0] in journal.revisions:
            raise ValueError("현재 자료에 중복되거나 잘못된 항목이 있습니다.")
        key, value, revision = row
        journal.revisions[key] = revision
        value = json.loads(value)
        if value is not None:
            journal.records[key] = value
    for row in journal.recent:
        if len(row) != 5:
            raise ValueError("최근 기록 형식이 올바르지 않습니다.")
        identity, when, actor, count, result = row
        result = json.loads(result)
        if result["id"] != identity or identity in journal.outcomes:
            raise ValueError("최근 기록 번호가 올바르지 않습니다.")
        journal.outcomes[identity] = result
        journal.history.append({"시각": when, "표시명": actor, "항목 수": int(count), "결과": result["status"]})
    journal.snapshot()  # Validate the complete reconstructed state before use.
    return journal


def legacy_journal(rows):
    if not rows or rows[0] != HEADER:
        raise ValueError("사무실 맵 전용 시트의 제목 행이 올바르지 않습니다.")
    journal = Journal(rows[1:])
    if not journal.records:
        if len(rows) > 1:
            raise ValueError("기존 기록에서 현재 자료를 복원하지 못했습니다. 초기화하지 마세요.")
        req = initial_request()
        rows = rows + [[req["id"], datetime.now(timezone.utc).isoformat(timespec="seconds"),
                       "초기 등록", dumps(req["changes"])]]
        journal = Journal(rows[1:])
    seen, recent = set(), []
    for identity, when, actor, changes in rows[1:]:
        if identity in seen:
            continue
        seen.add(identity)
        recent.append([identity, when, actor, str(len(json.loads(changes))), dumps(journal.outcomes[identity])])
    journal.recent = recent[-KEEP:]
    journal.snapshot()
    return journal


class SharedStore:
    def __init__(self, book):
        self.book = book
        self.lock = threading.RLock()
        self.journal = None
        self.checked = 0.0
        self.state_id = self.history_id = None

    def _ensure(self):
        tabs = {w.title: w for w in self.book.worksheets()}
        present = [name in tabs for name in (STATE, HISTORY, GUARD)]
        if all(present):
            self.state_id, self.history_id = tabs[STATE].id, tabs[HISTORY].id
            return
        if any(present):
            raise ValueError("새 저장소 탭 일부가 없습니다. 탭을 삭제하거나 초기화하지 마세요.")
        rows = tabs[TAB].get_all_values() if TAB in tabs else [HEADER]
        journal = legacy_journal(rows)
        used = {w.id for w in tabs.values()}
        ids = []
        while len(ids) < 3:
            identity = sheet_id()
            if identity not in used:
                ids.append(identity)
                used.add(identity)
        state_id, history_id, guard = ids
        state, history = encode(journal, guard)
        requests = [create_tab(STATE, state_id, max(100, len(state)), 3),
                    create_tab(HISTORY, history_id, KEEP + 1, 5),
                    create_tab(GUARD, guard, 1, 1, True),
                    put_rows(state_id, state, 3), put_rows(history_id, history, 5)]
        try:
            self.book.batch_update({"requests": requests})
        except Exception:
            # Lost response or concurrent migration: accept only a complete v2.
            tabs = {w.title: w for w in self.book.worksheets()}
            if not all(name in tabs for name in (STATE, HISTORY, GUARD)):
                raise
            state_id, history_id = tabs[STATE].id, tabs[HISTORY].id
        self.state_id, self.history_id = state_id, history_id

    def refresh(self, force=False):
        with self.lock:
            if not force and self.journal is not None and time.monotonic() - self.checked < 8:
                return self.journal
            if self.state_id is None:
                self._ensure()
            result = self.book.values_batch_get([f"'{STATE}'!A:C", f"'{HISTORY}'!A:E"])
            ranges = result["valueRanges"]
            journal = decode(ranges[0].get("values", []), ranges[1].get("values", []))
            self.journal, self.checked = journal, time.monotonic()
            return journal

    def snapshot(self):
        return self.refresh().snapshot()

    def commit(self, request, actor):
        validate_request(request)
        with self.lock:
            for attempt in range(4):
                current = self.refresh(force=True)
                if request["id"] in current.outcomes:
                    return copy.deepcopy(current.outcomes[request["id"]])
                candidate = copy.deepcopy(current)
                when = datetime.now(timezone.utc).isoformat(timespec="seconds")
                candidate.apply_row([request["id"], when, actor, dumps(request["changes"])])
                outcome = candidate.outcomes[request["id"]]
                candidate.recent = (candidate.recent + [[request["id"], when, actor,
                                    str(len(request["changes"])), dumps(outcome)]])[-KEEP:]
                guard = sheet_id()
                while guard in (current.guard, self.state_id, self.history_id):
                    guard = sheet_id()
                state, history = encode(candidate, guard)
                requests = [
                    {"deleteSheet": {"sheetId": current.guard}},
                    create_tab(GUARD, guard, 1, 1, True),
                    {"updateSheetProperties": {"properties": {"sheetId": self.state_id,
                        "gridProperties": {"rowCount": max(100, len(state))}},
                        "fields": "gridProperties.rowCount"}},
                    put_rows(self.state_id, state, 3), put_rows(self.history_id, history, 5)]
                try:
                    self.book.batch_update({"requests": requests})
                except Exception:
                    self.journal = None
                    latest = self.refresh(force=True)
                    if request["id"] in latest.outcomes:
                        return copy.deepcopy(latest.outcomes[request["id"]])
                    if latest.guard != current.guard:
                        continue  # A competing transaction consumed the guard.
                    raise
                self.journal = decode(state, history)
                self.checked = time.monotonic()
                return copy.deepcopy(outcome)
            raise RuntimeError("동시 수정이 계속되고 있습니다. 같은 요청을 다시 확인합니다.")


def connect(service_account, spreadsheet_id):
    import gspread
    from google.oauth2.service_account import Credentials
    credentials = Credentials.from_service_account_info(dict(service_account),
        scopes=["https://www.googleapis.com/auth/spreadsheets"])
    book = gspread.authorize(credentials).open_by_key(spreadsheet_id)
    return SharedStore(book)
