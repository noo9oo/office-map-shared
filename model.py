"""Deterministic per-record conflict checking over an append-only Sheets journal."""
from __future__ import annotations

import copy
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).parent
SEED = json.loads((ROOT / "seed.json").read_text(encoding="utf-8"))
ASSET_KEYS = set(json.loads((ROOT / "asset_keys.json").read_text(encoding="utf-8")))
LABEL_KEYS = set(SEED["labels"])


def text(value, limit, blank=False):
    return isinstance(value, str) and len(value) <= limit and (blank or bool(value.strip()))


def validate(payload):
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 3:
        raise ValueError("지원하지 않는 자료 형식입니다.")
    items, labels, assets = payload.get("items"), payload.get("labels"), payload.get("assets")
    if not isinstance(items, list) or len(items) > 10000 or not isinstance(labels, dict) or not isinstance(assets, dict):
        raise ValueError("자료 구조가 올바르지 않습니다.")
    ids = set()
    for i in items:
        if not isinstance(i, dict) or not text(i.get("id"), 150) or i["id"] in ids or not text(i.get("name"), 120) or type(i.get("cabinet")) is not int or not 1 <= i["cabinet"] <= 10 or i.get("level") not in ("top", "middle", "bottom", "all") or not text(i.get("note"), 500, True):
            raise ValueError("비품의 이름·번호·칸을 확인해 주세요.")
        ids.add(i["id"])
    custom, deleted = assets.get("custom"), assets.get("deleted")
    if not isinstance(custom, list) or len(custom) > 200 or not isinstance(deleted, list) or any(not isinstance(k, str) or k not in ASSET_KEYS for k in deleted):
        raise ValueError("고정 자산 목록이 올바르지 않습니다.")
    custom_ids = set()
    for a in custom:
        if not isinstance(a, dict) or not isinstance(a.get("key"), str) or not re.fullmatch(r"custom-[a-z0-9-]{1,80}", a["key"]) or a["key"] in custom_ids or not text(a.get("name"), 60) or a.get("type") not in ("storage", "table", "printer", "purifier", "box"):
            raise ValueError("추가한 자산이 올바르지 않습니다.")
        for k, low, high in (("x", 14, 289), ("y", 18, 747)):
            if type(a.get(k)) not in (int, float) or not math.isfinite(a[k]) or not low <= a[k] <= high:
                raise ValueError("자산 위치가 지도 밖입니다.")
        if any(type(a.get(k)) not in (int, float) or not math.isfinite(a[k]) or not 8 <= a[k] <= 120 for k in ("w", "d")) or a["x"] + a["w"] > 297 or a["y"] + a["d"] > 755:
            raise ValueError("자산 크기가 올바르지 않습니다.")
        custom_ids.add(a["key"])
    if set(labels) != LABEL_KEYS | custom_ids or any(not text(v, 60) for v in labels.values()):
        raise ValueError("좌석·자산 이름이 누락되었거나 올바르지 않습니다.")
    return payload


def flatten(payload):
    result = {"item/" + i["id"]: i for i in payload["items"]}
    result.update({"label/" + k: v for k, v in payload["labels"].items()})
    result.update({"asset/" + a["key"]: a for a in payload["assets"]["custom"]})
    result.update({"removed/" + k: True for k in payload["assets"]["deleted"]})
    return copy.deepcopy(result)


def unflatten(records):
    payload = {"schemaVersion": 3, "items": [], "labels": {}, "assets": {"custom": [], "deleted": []}}
    for key, value in records.items():
        kind, identity = key.split("/", 1)
        if kind == "item" and isinstance(value, dict) and value.get("id") == identity:
            payload["items"].append(value)
        elif kind == "label":
            payload["labels"][identity] = value
        elif kind == "asset" and isinstance(value, dict) and value.get("key") == identity:
            payload["assets"]["custom"].append(value)
        elif kind == "removed" and value is True:
            payload["assets"]["deleted"].append(identity)
        else:
            raise ValueError("잘못된 자료 항목입니다.")
    return validate(payload)


def validate_request(request):
    if not isinstance(request, dict) or not isinstance(request.get("id"), str) or not re.fullmatch(r"[A-Za-z0-9_-]{8,100}", request["id"]):
        raise ValueError("저장 요청 번호가 올바르지 않습니다.")
    changes = request.get("changes")
    if not isinstance(changes, list) or not 1 <= len(changes) <= 2000:
        raise ValueError("한 번에 변경할 항목이 너무 많거나 비어 있습니다.")
    keys = set()
    for c in changes:
        if not isinstance(c, dict) or not isinstance(c.get("key"), str) or len(c["key"]) > 170 or not re.match(r"^(item|label|asset|removed)/.+$", c["key"]) or c["key"] in keys or "value" not in c or "expected" not in c or (c["expected"] is not None and not text(c["expected"], 100)):
            raise ValueError("변경 항목의 형식이 올바르지 않습니다.")
        keys.add(c["key"])
    if len(json.dumps(request, ensure_ascii=False).encode("utf-8")) > 45000:
        raise ValueError("한 번의 저장이 너무 큽니다. 비품을 나누어 변경해 주세요.")
    return request


def initial_request():
    return {"id": "office-atlas-initial-v1", "changes": [{"key": k, "expected": None, "value": v} for k, v in flatten(SEED).items()]}


class Journal:
    """Replay in physical row order. Tombstone revisions prevent stale resurrection."""

    def __init__(self, rows=()):
        self.records, self.revisions, self.outcomes, self.history = {}, {}, {}, []
        self.count = 0
        for row in rows:
            self.apply_row(row)

    def apply_row(self, row):
        self.count += 1
        if len(row) != 4:
            raise ValueError("공용 시트의 기록 형식이 바뀌었습니다. 행을 수정하거나 정렬하지 마세요.")
        event_id, when, actor, data = row
        request = validate_request({"id": event_id, "changes": json.loads(data)})
        if event_id in self.outcomes:
            return  # Retrying an uncertain append can create another row; never apply twice.
        conflicts = [c["key"] for c in request["changes"] if self.revisions.get(c["key"]) != c["expected"]]
        result = {"id": event_id, "status": "conflict" if conflicts else "saved", "conflicts": conflicts}
        if not conflicts:
            proposed = copy.deepcopy(self.records)
            for c in request["changes"]:
                if c["value"] is None:
                    proposed.pop(c["key"], None)
                else:
                    proposed[c["key"]] = c["value"]
            try:
                unflatten(proposed)
            except (ValueError, TypeError, KeyError) as exc:
                result.update(status="invalid", message=str(exc))
            else:
                self.records = proposed
                for c in request["changes"]:
                    self.revisions[c["key"]] = event_id
        self.outcomes[event_id] = result
        self.history.append({"시각": when, "표시명": actor, "항목 수": len(request["changes"]), "결과": result["status"]})

    def snapshot(self):
        if not self.records:
            raise ValueError("공용 저장소가 아직 초기화되지 않았습니다.")
        return {"payload": unflatten(self.records), "revisions": copy.deepcopy(self.revisions), "revision": self.count}
