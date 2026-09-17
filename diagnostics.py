"""Safe connection messages: never display raw provider errors or credentials."""
import json


def connection_message(exc):
    code = getattr(getattr(exc, "response", None), "status_code", None)
    kind = type(exc).__name__
    if isinstance(exc, PermissionError) or code == 403:
        return "시트 접근 또는 편집이 거부되었습니다. 새 시트의 client_email 편집자 공유와 Google Sheets API 사용 설정을 확인해 주세요. [S403]"
    if kind == "SpreadsheetNotFound" or code == 404:
        return "시트를 찾을 수 없습니다. OFFICE_SHEET_ID와 서비스 계정의 공유 권한을 확인해 주세요. [S404]"
    if code == 429:
        return "구글 시트 요청 한도에 도달했습니다. 잠시 후 자동으로 다시 시도합니다. [S429]"
    if kind in ("RefreshError", "MalformedError") or code == 401:
        return "서비스 계정 인증을 확인해 주세요. Streamlit Secrets의 계정 정보나 키가 유효하지 않을 수 있습니다. [AUTH]"
    if isinstance(exc, json.JSONDecodeError):
        return "공용 시트 기록의 JSON 형식이 올바르지 않습니다. office_map_events_v1 탭의 기록을 확인해야 합니다. 행을 삭제하거나 초기화하지 마세요. [DATA-JSON]"
    if isinstance(exc, ValueError):
        if str(exc) == "사무실 맵 전용 시트의 제목 행이 올바르지 않습니다.":
            return "office_map_events_v1 탭의 첫 행은 A1부터 event_id, utc_time, display_name, changes_json 순서여야 합니다. 기존 기록은 삭제하지 마세요. [DATA-HEADER]"
        if str(exc) == "공용 저장소가 아직 초기화되지 않았습니다.":
            return "초기 자료가 적용되지 않았습니다. seed.json과 공용 시트 기록을 확인해야 합니다. 기존 기록은 삭제하지 마세요. [DATA-INIT]"
        return "공용 자료의 제목 행 또는 데이터 형식이 올바르지 않습니다. office_map_events_v1 탭을 확인해야 합니다. 행을 삭제하거나 초기화하지 마세요. [DATA]"
    return "공용 자료 요청에 실패했습니다. 잠시 후 다시 시도해 주세요. 계속되면 배포 로그를 확인해야 합니다. [CONNECTION]"
