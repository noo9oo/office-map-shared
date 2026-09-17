from pathlib import Path
import hmac

import streamlit as st
import streamlit.components.v1 as components

from storage import connect

st.set_page_config(page_title="공용 사무실 비품 맵", page_icon="🗄️", layout="wide")
ROOT = Path(__file__).parent
office_map = components.declare_component("office_atlas_shared", path=str(ROOT / "frontend"))


@st.cache_resource
def store():
    # Deliberately different from snack-lab's GSHEET_ID to prevent accidental reuse.
    return connect(st.secrets["gcp_service_account"], st.secrets["OFFICE_SHEET_ID"])


def main():
    st.markdown("<style>.block-container{padding:1rem;max-width:none}header[data-testid=stHeader]{height:0}</style>", unsafe_allow_html=True)
    required = ("OFFICE_SHEET_ID", "OFFICE_PASSWORD", "gcp_service_account")
    try:
        configured = all(k in st.secrets for k in required)
    except Exception:
        configured = False
    if not configured:
        st.info("배포 준비가 필요합니다. README의 새 구글 시트와 Streamlit Secrets 설정을 완료해 주세요.")
        st.stop()
    password = str(st.secrets["OFFICE_PASSWORD"])
    if not password:
        st.error("OFFICE_PASSWORD를 설정해 주세요.")
        st.stop()
    if not st.session_state.get("office_authenticated"):
        st.title("사무실 비품 맵")
        with st.form("login"):
            actor = st.text_input("수정 기록에 표시할 이름", max_chars=40)
            supplied = st.text_input("공용 접속 비밀번호", type="password")
            if st.form_submit_button("접속"):
                if actor.strip() and hmac.compare_digest(supplied.encode(), password.encode()):
                    st.session_state.office_authenticated = True
                    st.session_state.office_actor = actor.strip()
                    st.rerun()
                else:
                    st.error("이름과 비밀번호를 확인해 주세요.")
        st.stop()
    top, logout = st.columns([9, 1])
    top.caption(f"{st.session_state.office_actor} · 공용 구글 시트 저장 · 약 8~16초 간격으로 변경 확인")
    if logout.button("로그아웃"):
        st.session_state.clear()
        st.rerun()
    try:
        shared = store()
    except Exception:
        st.error("구글 시트에 연결하지 못했습니다. OFFICE_SHEET_ID와 서비스 계정의 편집 권한을 확인해 주세요.")
        st.stop()

    @st.fragment(run_every=8)
    def live_map():
        ack = st.session_state.get("office_ack")
        try:
            snapshot = shared.snapshot()
            error = ""
        except Exception:
            snapshot = None
            error = "공용 자료를 읽지 못했습니다. 연결 복구 후 자동으로 다시 확인합니다."
        request = office_map(snapshot=snapshot, ack=ack, error=error, key="office_map", default=None)
        if isinstance(request, dict) and request.get("id") != st.session_state.get("office_handled"):
            try:
                result = shared.commit(request, st.session_state.office_actor)
            except ValueError as exc:
                result = {"id": request.get("id"), "status": "invalid", "message": str(exc)}
            except Exception:
                # Keep the id unhandled. Next fragment run checks whether the append landed.
                st.warning("저장 응답을 확인하지 못했습니다. 같은 요청을 자동 재확인 중입니다. 창을 닫지 마세요.")
                return
            st.session_state.office_ack = result
            st.session_state.office_handled = request.get("id")
            st.rerun(scope="fragment")
        with st.expander("최근 수정 기록"):
            try:
                st.dataframe(list(reversed(shared.refresh().history[-30:])), hide_index=True, width="stretch")
            except Exception:
                st.caption("수정 기록을 불러오지 못했습니다.")

    live_map()


if __name__ == "__main__":
    main()
