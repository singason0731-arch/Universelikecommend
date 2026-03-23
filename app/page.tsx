"use client";

import { useEffect, useMemo, useState } from "react";

type FormType =
  | "feed"
  | "volunteer"
  | "skip"
  | "twofeed"
  | "nofeed"
  | "sub-feed"
  | "sub-nofeed"
  | "sub-volunteer"
  | "staff";

type SubmissionItem = {
  id: string | number;
  nickname: string;
  form_type?: FormType;
  formType?: FormType;
  link1: string;
  link2: string;
  created_at?: string;
  createdAt?: string;
};

const SKIP_LIMIT = 7;
const OPEN_TIME = "14:30";
const CLOSE_TIME = "22:00";

function parseTimeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function getSeoulNowMinutes() {
  const timeText = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  return parseTimeToMinutes(timeText);
}

export default function Home() {
  const [formType, setFormType] = useState<FormType>("feed");
  const [nickname, setNickname] = useState("");
  const [userId, setUserId] = useState("");
  const [link1, setLink1] = useState("");
  const [link2, setLink2] = useState("");
  const [staffLinkCount, setStaffLinkCount] = useState<"1" | "2">("1");
  const [skipUsedCount, setSkipUsedCount] = useState(0);

  const [rememberMe, setRememberMe] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [showCollectedSection, setShowCollectedSection] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [nowMinutes, setNowMinutes] = useState(getSeoulNowMinutes());
  const [alreadyParticipatedToday, setAlreadyParticipatedToday] = useState(false);

  const skipRemainingCount = SKIP_LIMIT - skipUsedCount;
  const isSkipClosed = skipRemainingCount <= 0;

  const openMinutes = parseTimeToMinutes(OPEN_TIME);
  const closeMinutes = parseTimeToMinutes(CLOSE_TIME);
  const isFormOpen = nowMinutes >= openMinutes && nowMinutes <= closeMinutes;

  const todayText = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Seoul",
  }).format(new Date());

  useEffect(() => {
    const savedNickname = localStorage.getItem("memberNickname");
    const savedUserId = localStorage.getItem("memberUserId");
    const savedRemember = localStorage.getItem("rememberMember");

    if (savedRemember === "true" && savedNickname && savedUserId) {
      setNickname(savedNickname);
      setUserId(savedUserId);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMinutes(getSeoulNowMinutes());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadEntries = async () => {
      try {
        setIsLoadingEntries(true);

        const query =
          nickname.trim() && userId.trim()
            ? `?nickname=${encodeURIComponent(nickname.trim())}&userId=${encodeURIComponent(
                userId.trim()
              )}`
            : "";

        const response = await fetch(`/api/entries${query}`, {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.ok) return;

        setSubmissions(data.entries || []);
        setSkipUsedCount(data.skipCount || 0);
        setAlreadyParticipatedToday(!!data.alreadyParticipated);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoadingEntries(false);
      }
    };

    loadEntries();
  }, [nickname, userId]);

  const resetLinks = () => {
    setLink1("");
    setLink2("");
    setStaffLinkCount("1");
  };

  const handleTabChange = (nextType: FormType) => {
    setFormType(nextType);
    setErrorMessage("");
    setSuccessMessage("");
    resetLinks();
  };

  const requiresLink1 = useMemo(() => {
    return (
      formType === "feed" ||
      formType === "skip" ||
      formType === "twofeed" ||
      formType === "sub-feed" ||
      formType === "staff"
    );
  }, [formType]);

  const requiresLink2 = useMemo(() => {
    return formType === "twofeed" || (formType === "staff" && staffLinkCount === "2");
  }, [formType, staffLinkCount]);

  const formTitleMap: Record<FormType, string> = {
    feed: "피드/릴스 신청",
    volunteer: "봉사 신청",
    skip: "스킵 신청",
    twofeed: "투피드 신청",
    nofeed: "노피드 신청",
    "sub-feed": "부계 피드/릴스 신청",
    "sub-nofeed": "부계 노피드 신청",
    "sub-volunteer": "부계 봉사 신청",
    staff: "운영진 신청",
  };

  const formDescMap: Record<FormType, string> = {
    feed: "게시물 링크 1개를 작성하면 됩니다.",
    volunteer: "링크 작성 없이 신청하면 됩니다.",
    skip: "내 게시물 링크를 등록하고 품앗이 참여는 스킵하는 유형입니다.",
    twofeed: "게시물 링크 2개를 작성하면 됩니다.",
    nofeed: "링크 작성 없이 신청하면 됩니다.",
    "sub-feed": "부계 게시물 링크 1개를 작성하면 됩니다.",
    "sub-nofeed": "링크 작성 없이 신청하면 됩니다.",
    "sub-volunteer": "링크 작성 없이 신청하면 됩니다.",
    staff: "운영진은 링크 1개 또는 2개까지 선택 작성할 수 있습니다.",
  };

  const isValidUrl = (value: string) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const validateLinks = () => {
    if (requiresLink1 && !link1.trim()) {
      return "링크를 입력해야 합니다.";
    }

    if (requiresLink2 && !link2.trim()) {
      return "두 번째 링크를 입력해야 합니다.";
    }

    if (requiresLink1 && link1.trim() && !isValidUrl(link1.trim())) {
      return "올바른 링크가 아닙니다.";
    }

    if (requiresLink2 && link2.trim() && !isValidUrl(link2.trim())) {
      return "올바른 링크가 아닙니다.";
    }

    return "";
  };

  const handleVerifyMember = async () => {
    setAuthMessage("");
    setErrorMessage("");
    setSuccessMessage("");
    setAlreadyParticipatedToday(false);

    if (!nickname.trim() || !userId.trim()) {
      setAuthMessage("닉네임과 아이디를 모두 입력해야 합니다.");
      setIsVerified(false);
      return;
    }

    try {
      setIsVerifying(true);

      const response = await fetch("/api/member-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname,
          userId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setAuthMessage(data.message || "회원 확인에 실패했습니다.");
        setIsVerified(false);
        return;
      }

      setAuthMessage("회원 확인이 완료되었습니다.");
      setIsVerified(true);

      if (rememberMe) {
        localStorage.setItem("memberNickname", nickname.trim());
        localStorage.setItem("memberUserId", userId.trim());
        localStorage.setItem("rememberMember", "true");
      } else {
        localStorage.removeItem("memberNickname");
        localStorage.removeItem("memberUserId");
        localStorage.removeItem("rememberMember");
      }

      const checkResponse = await fetch(
        `/api/entries?nickname=${encodeURIComponent(nickname.trim())}&userId=${encodeURIComponent(
          userId.trim()
        )}`,
        { cache: "no-store" }
      );
      const checkData = await checkResponse.json();

      if (checkResponse.ok && checkData.ok) {
        setSubmissions(checkData.entries || []);
        setSkipUsedCount(checkData.skipCount || 0);
        setAlreadyParticipatedToday(!!checkData.alreadyParticipated);

        if (checkData.alreadyParticipated) {
          setSuccessMessage("오늘은 이미 참여완료 했어요.");
          setShowCollectedSection(true);
        }
      }
    } catch (error) {
      console.error(error);
      setAuthMessage("회원 확인 중 오류가 발생했습니다.");
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!isVerified) {
      setErrorMessage("먼저 회원 확인을 완료해야 합니다.");
      return;
    }

    if (alreadyParticipatedToday) {
      setErrorMessage("오늘은 이미 참여완료 했어요.");
      setShowCollectedSection(true);
      return;
    }

    if (!isFormOpen) {
      setErrorMessage("현재는 참여 가능 시간이 아닙니다.");
      return;
    }

    if (!nickname.trim()) {
      setErrorMessage("닉네임을 입력해야 합니다.");
      return;
    }

    if (formType === "skip" && isSkipClosed) {
      setErrorMessage("스킵 신청이 마감되었습니다.");
      return;
    }

    const linkValidationMessage = validateLinks();
    if (linkValidationMessage) {
      setErrorMessage(linkValidationMessage);
      return;
    }

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname,
          userId,
          formType,
          link1: requiresLink1 ? link1.trim() : "",
          link2: requiresLink2 ? link2.trim() : "",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setErrorMessage(data.message || "접수 중 오류가 발생했습니다.");

        if (data.alreadyParticipated) {
          setAlreadyParticipatedToday(true);
          setShowCollectedSection(true);
        }
        return;
      }

      setSuccessMessage(data.message || "정상적으로 접수되었습니다.");
      setShowCollectedSection(true);
      setAlreadyParticipatedToday(true);

      setLink1("");
      setLink2("");
      setStaffLinkCount("1");

      const refreshResponse = await fetch(
        `/api/entries?nickname=${encodeURIComponent(nickname.trim())}&userId=${encodeURIComponent(
          userId.trim()
        )}`,
        { cache: "no-store" }
      );
      const refreshData = await refreshResponse.json();

      if (refreshResponse.ok && refreshData.ok) {
        setSubmissions(refreshData.entries || []);
        setSkipUsedCount(refreshData.skipCount || 0);
        setAlreadyParticipatedToday(!!refreshData.alreadyParticipated);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("접수 중 오류가 발생했습니다.");
    }
  };

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #fffdf9 0%, #fffaf3 40%, #ffffff 100%)",
    padding: "18px 12px 40px",
    fontFamily:
      'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: "#1f1f1f",
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "520px",
    margin: "0 auto",
  };

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #f1ede7",
    borderRadius: "22px",
    padding: "18px 16px",
    boxShadow: "0 6px 18px rgba(0,0,0,0.03)",
    marginBottom: "14px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 14px",
    borderRadius: "14px",
    border: "1px solid #e5ddd2",
    outline: "none",
    fontSize: "15px",
    background: "#fffdfb",
    boxSizing: "border-box",
    minHeight: "48px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 700,
    marginBottom: "8px",
    color: "#403c37",
  };

  const toggleWrapStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  };

  const toggleButtonStyle = (active: boolean, disabled = false): React.CSSProperties => ({
    padding: "12px 14px",
    borderRadius: "14px",
    border: active ? "1px solid #1f1f1f" : "1px solid #e7dfd3",
    background: disabled ? "#f5f5f5" : active ? "#1f1f1f" : "#ffffff",
    color: disabled ? "#9a9a9a" : active ? "#ffffff" : "#333333",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.2,
  });

  const primaryButtonStyle: React.CSSProperties = {
    width: "100%",
    border: "none",
    borderRadius: "18px",
    padding: "16px 18px",
    background: "#1f1f1f",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 800,
    cursor: "pointer",
    minHeight: "54px",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #e7dfd3",
    borderRadius: "18px",
    padding: "15px 18px",
    background: "#ffffff",
    color: "#2a2a2a",
    fontSize: "15px",
    fontWeight: 800,
    cursor: "pointer",
    minHeight: "52px",
    marginTop: "12px",
  };

  const messageBox = (bg: string, border: string): React.CSSProperties => ({
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: "18px",
    padding: "15px 16px",
    marginBottom: "14px",
  });

  const renderCollectedSection = () => (
    <>
      <button
        type="button"
        onClick={() => setShowCollectedSection((prev) => !prev)}
        style={secondaryButtonStyle}
      >
        현재까지 취합된 링크 확인하기
      </button>

      {showCollectedSection && (
        <section style={{ ...cardStyle, marginTop: "12px" }}>
          <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "12px" }}>
            현재까지 취합된 링크
          </div>

          {isLoadingEntries ? (
            <div
              style={{
                padding: "15px 14px",
                borderRadius: "16px",
                background: "#faf7f3",
                border: "1px dashed #e7ddd0",
                fontSize: "14px",
                color: "#6f685f",
                lineHeight: 1.6,
              }}
            >
              취합된 링크를 불러오는 중입니다.
            </div>
          ) : submissions.length === 0 ? (
            <div
              style={{
                padding: "15px 14px",
                borderRadius: "16px",
                background: "#faf7f3",
                border: "1px dashed #e7ddd0",
                fontSize: "14px",
                color: "#6f685f",
                lineHeight: 1.6,
              }}
            >
              아직 취합된 링크가 없습니다.
            </div>
          ) : (
            <div
              style={{
                background: "#fffdfa",
                border: "1px solid #eee7dd",
                borderRadius: "16px",
                padding: "16px 14px",
                whiteSpace: "pre-wrap",
                lineHeight: 1.8,
                fontSize: "14px",
                color: "#2b2b2b",
              }}
            >
              {submissions
                .map((item, index) => {
                  const currentFormType = item.form_type || item.formType;

                  const typeLabel =
                    currentFormType === "skip"
                      ? " (스킵)"
                      : currentFormType === "volunteer"
                      ? " (봉사)"
                      : currentFormType === "twofeed"
                      ? " (투피드)"
                      : currentFormType === "nofeed"
                      ? " (노피드)"
                      : currentFormType === "sub-feed"
                      ? " (부계 피드/릴스)"
                      : currentFormType === "sub-nofeed"
                      ? " (부계 노피드)"
                      : currentFormType === "sub-volunteer"
                      ? " (부계 봉사)"
                      : currentFormType === "staff"
                      ? " (운영진)"
                      : "";

                  const lines = [`${index + 1}. ${item.nickname}${typeLabel}`];
                  if (item.link1) lines.push(item.link1);
                  if (item.link2) lines.push(item.link2);

                  return lines.join("\n");
                })
                .join("\n\n")}
            </div>
          )}
        </section>
      )}
    </>
  );

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <section style={cardStyle}>
          <div
            style={{
              display: "inline-block",
              padding: "6px 11px",
              borderRadius: "999px",
              background: "#f7f2ea",
              fontSize: "11px",
              fontWeight: 800,
              marginBottom: "12px",
            }}
          >
            접수 페이지
          </div>

          <h1 style={{ fontSize: "28px", margin: "0 0 8px 0", lineHeight: 1.25 }}>
            좋댓 신청 접수
          </h1>

          <p style={{ margin: 0, color: "#6e675f", lineHeight: 1.7, fontSize: "14px" }}>
            오늘 날짜와 접수 시간을 확인한 뒤 신청하면 됩니다.
          </p>

          <div
            style={{
              marginTop: "14px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            <div
              style={{
                background: "#faf6ef",
                border: "1px solid #eee4d3",
                borderRadius: "16px",
                padding: "12px",
              }}
            >
              <div style={{ fontSize: "12px", color: "#7b6f60", fontWeight: 700, marginBottom: "4px" }}>
                날짜
              </div>
              <div style={{ fontSize: "14px", fontWeight: 800, lineHeight: 1.5 }}>
                {todayText}
              </div>
            </div>

            <div
              style={{
                background: "#faf6ef",
                border: "1px solid #eee4d3",
                borderRadius: "16px",
                padding: "12px",
              }}
            >
              <div style={{ fontSize: "12px", color: "#7b6f60", fontWeight: 700, marginBottom: "4px" }}>
                접수 시간
              </div>
              <div style={{ fontSize: "14px", fontWeight: 800, lineHeight: 1.5 }}>
                {OPEN_TIME} ~ {CLOSE_TIME}
              </div>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "12px" }}>
            회원 확인
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={labelStyle}>닉네임</label>
            <input
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setIsVerified(false);
                setAuthMessage("");
                setAlreadyParticipatedToday(false);
              }}
              placeholder="닉네임을 입력합니다."
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={labelStyle}>아이디</label>
            <input
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setIsVerified(false);
                setAuthMessage("");
                setAlreadyParticipatedToday(false);
              }}
              placeholder="@ 없이 입력해도 됩니다."
              style={inputStyle}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              marginBottom: "14px",
            }}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            자동 로그인
          </label>

          <button
            type="button"
            onClick={handleVerifyMember}
            style={primaryButtonStyle}
            disabled={isVerifying}
          >
            {isVerifying ? "확인 중입니다." : "회원 확인하기"}
          </button>

          {authMessage && (
            <div
              style={{
                marginTop: "12px",
                ...messageBox(
                  isVerified ? "#f4fbf5" : "#fff4f4",
                  isVerified ? "#d7edd9" : "#f2d1d1"
                ),
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  lineHeight: 1.6,
                  fontWeight: 700,
                  color: isVerified ? "#2b4d30" : "#6e2f2f",
                }}
              >
                {authMessage}
              </div>
            </div>
          )}
        </section>

        <section
          style={{
            ...cardStyle,
            background: isVerified ? "#fff8ee" : "#f7f7f7",
            border: isVerified ? "1px solid #f3e3c7" : "1px solid #e5e5e5",
          }}
        >
          <div>
            <div style={{ fontSize: "12px", color: "#7b6f60", marginBottom: "4px", fontWeight: 700 }}>
              스킵 현황
            </div>
            <div style={{ fontSize: "17px", fontWeight: 900, lineHeight: 1.45 }}>
              {isSkipClosed
                ? "스킵 신청이 마감되었습니다."
                : `스킵 사용 가능 인원이 ${skipRemainingCount}명 남았습니다.`}
            </div>
          </div>
        </section>

        {successMessage && (
          <section style={messageBox("#f4fbf5", "#d7edd9")}>
            <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "6px", color: "#2f6a36" }}>
              제출 완료
            </div>
            <div style={{ fontSize: "14px", lineHeight: 1.6, color: "#2b4d30", fontWeight: 600 }}>
              {successMessage}
            </div>
          </section>
        )}

        {errorMessage && (
          <section style={messageBox("#fff4f4", "#f2d1d1")}>
            <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "6px", color: "#8a3131" }}>
              확인 필요
            </div>
            <div style={{ fontSize: "14px", lineHeight: 1.6, color: "#6e2f2f", fontWeight: 600 }}>
              {errorMessage}
            </div>
          </section>
        )}

        {isVerified ? (
          alreadyParticipatedToday ? (
            <>
              <section style={cardStyle}>
                <div style={{ fontSize: "14px", lineHeight: 1.7, color: "#6d665d", fontWeight: 600 }}>
                  오늘은 이미 참여완료 했어요.
                  <br />
                  취합된 링크만 확인할 수 있습니다.
                </div>
              </section>

              {renderCollectedSection()}
            </>
          ) : (
            <>
              <section style={cardStyle}>
                <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "12px" }}>
                  신청 유형 선택
                </div>

                <div style={toggleWrapStyle}>
                  <button type="button" onClick={() => handleTabChange("feed")} style={toggleButtonStyle(formType === "feed")}>
                    피드/릴스
                  </button>
                  <button type="button" onClick={() => handleTabChange("volunteer")} style={toggleButtonStyle(formType === "volunteer")}>
                    봉사
                  </button>
                  <button
                    type="button"
                    onClick={() => isFormOpen && !isSkipClosed && handleTabChange("skip")}
                    style={toggleButtonStyle(formType === "skip", !isFormOpen || isSkipClosed)}
                    disabled={!isFormOpen || isSkipClosed}
                  >
                    스킵
                  </button>
                  <button type="button" onClick={() => handleTabChange("twofeed")} style={toggleButtonStyle(formType === "twofeed")}>
                    투피드
                  </button>
                  <button type="button" onClick={() => handleTabChange("nofeed")} style={toggleButtonStyle(formType === "nofeed")}>
                    노피드
                  </button>
                  <button type="button" onClick={() => handleTabChange("sub-feed")} style={toggleButtonStyle(formType === "sub-feed")}>
                    부계 피드/릴스
                  </button>
                  <button type="button" onClick={() => handleTabChange("sub-nofeed")} style={toggleButtonStyle(formType === "sub-nofeed")}>
                    부계 노피드
                  </button>
                  <button type="button" onClick={() => handleTabChange("sub-volunteer")} style={toggleButtonStyle(formType === "sub-volunteer")}>
                    부계 봉사
                  </button>
                  <button type="button" onClick={() => handleTabChange("staff")} style={toggleButtonStyle(formType === "staff")}>
                    운영진
                  </button>
                </div>
              </section>

              <section style={cardStyle}>
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "19px", fontWeight: 900, marginBottom: "6px", lineHeight: 1.3 }}>
                    {formTitleMap[formType]}
                  </div>
                  <div style={{ fontSize: "13px", color: "#7a746c", lineHeight: 1.6 }}>
                    {formDescMap[formType]}
                  </div>
                </div>

                <div
                  style={{
                    background: "#fcfaf7",
                    border: "1px solid #eee6da",
                    borderRadius: "16px",
                    padding: "14px",
                    marginBottom: "16px",
                    fontSize: "13px",
                    color: "#6d665d",
                    lineHeight: 1.6,
                    fontWeight: 600,
                  }}
                >
                  링크는 수정이 불가능합니다.
                </div>

                {formType === "staff" && (
                  <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>운영진 링크 개수</label>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setStaffLinkCount("1");
                          setLink2("");
                          setErrorMessage("");
                        }}
                        style={toggleButtonStyle(staffLinkCount === "1")}
                      >
                        1개
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setStaffLinkCount("2");
                          setErrorMessage("");
                        }}
                        style={toggleButtonStyle(staffLinkCount === "2")}
                      >
                        2개
                      </button>
                    </div>
                  </div>
                )}

                {requiresLink1 && (
                  <div style={{ marginBottom: requiresLink2 ? "12px" : "0" }}>
                    <label style={labelStyle}>
                      {formType === "twofeed"
                        ? "첫 번째 링크"
                        : formType === "staff"
                        ? "링크 1"
                        : "링크"}
                    </label>
                    <input
                      value={link1}
                      onChange={(e) => {
                        setLink1(e.target.value);
                        setErrorMessage("");
                        setSuccessMessage("");
                      }}
                      placeholder="https:// 형태의 링크를 입력합니다."
                      style={inputStyle}
                    />
                  </div>
                )}

                {requiresLink2 && (
                  <div>
                    <label style={labelStyle}>
                      {formType === "twofeed" ? "두 번째 링크" : "링크 2"}
                    </label>
                    <input
                      value={link2}
                      onChange={(e) => {
                        setLink2(e.target.value);
                        setErrorMessage("");
                        setSuccessMessage("");
                      }}
                      placeholder="https:// 형태의 링크를 입력합니다."
                      style={inputStyle}
                    />
                  </div>
                )}

                {!requiresLink1 && !requiresLink2 && (
                  <div
                    style={{
                      padding: "15px 14px",
                      borderRadius: "16px",
                      background: "#faf7f3",
                      border: "1px dashed #e7ddd0",
                      fontSize: "14px",
                      color: "#6f685f",
                      lineHeight: 1.6,
                    }}
                  >
                    이 유형은 링크 작성 없이 접수하면 됩니다.
                  </div>
                )}
              </section>

              <button
                type="button"
                onClick={handleSubmit}
                style={{
                  ...primaryButtonStyle,
                  background: !isFormOpen ? "#b8b8b8" : "#1f1f1f",
                  cursor: !isFormOpen ? "not-allowed" : "pointer",
                }}
                disabled={!isFormOpen}
              >
                {isFormOpen ? "제출하기" : "참여 시간이 아닙니다"}
              </button>

              {renderCollectedSection()}
            </>
          )
        ) : (
          <section style={cardStyle}>
            <div style={{ fontSize: "14px", lineHeight: 1.7, color: "#6d665d", fontWeight: 600 }}>
              회원 확인이 완료되어야 접수 폼이 열립니다.
            </div>
          </section>
        )}
      </div>
    </main>
  );
}