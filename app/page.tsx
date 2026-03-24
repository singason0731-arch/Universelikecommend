"use client";

import { useEffect, useMemo, useState } from "react";

function cleanInstagramLink(url: string) {
  if (!url) return "";

  try {
    const parsed = new URL(url);

    // 1. /? 이후 제거
    let pathname = parsed.pathname;

    // 2. reel → p 변환
    if (pathname.startsWith("/reel/")) {
      pathname = pathname.replace("/reel/", "/p/");
    }

    // 3. 마지막 / 보정
    if (!pathname.endsWith("/")) {
      pathname += "/";
    }

    return `https://www.instagram.com${pathname}`;
  } catch {
    return url;
  }
}

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
  is_reels1?: boolean;
  is_reels2?: boolean;
};

type ItemStatus = {
  canUseSkip: boolean;
  canUseTwofeed: boolean;
  skipOwnedCount: number;
  twofeedOwnedCount: number;
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
  const [isReels1, setIsReels1] = useState(false);
  const [isReels2, setIsReels2] = useState(false);
  const [staffLinkCount, setStaffLinkCount] = useState<"1" | "2">("1");
  const [skipUsedCount, setSkipUsedCount] = useState(0);

  const [rememberMe, setRememberMe] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [showCollectedSection, setShowCollectedSection] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [nowMinutes, setNowMinutes] = useState(getSeoulNowMinutes());
  const [alreadyParticipatedToday, setAlreadyParticipatedToday] = useState(false);
  const [itemStatus, setItemStatus] = useState<ItemStatus>({
    canUseSkip: false,
    canUseTwofeed: false,
    skipOwnedCount: 0,
    twofeedOwnedCount: 0,
  });

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

  const resetLinks = () => {
    setLink1("");
    setLink2("");
    setIsReels1(false);
    setIsReels2(false);
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
    "sub-volunteer": "부계 봉사 신청",
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

  const loadEntries = async (nicknameOverride?: string, userIdOverride?: string) => {
    try {
      setIsLoadingEntries(true);

      const n = nicknameOverride ?? nickname;
      const u = userIdOverride ?? userId;

      const query =
        n.trim() && u.trim()
          ? `?nickname=${encodeURIComponent(n.trim())}&userId=${encodeURIComponent(u.trim())}`
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

  const handleVerifyMember = async (
    nicknameOverride?: string,
    userIdOverride?: string,
    rememberOverride?: boolean
  ) => {
    setAuthMessage("");
    setErrorMessage("");
    setSuccessMessage("");
    setAlreadyParticipatedToday(false);
    setItemStatus({
      canUseSkip: false,
      canUseTwofeed: false,
      skipOwnedCount: 0,
      twofeedOwnedCount: 0,
    });

    const nextNickname = (nicknameOverride ?? nickname).trim();
    const nextUserId = (userIdOverride ?? userId).trim();
    const nextRemember = rememberOverride ?? rememberMe;

    if (!nextNickname || !nextUserId) {
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
          nickname: nextNickname,
          userId: nextUserId,
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

      if (data.itemStatus) {
        setItemStatus(data.itemStatus);
      }

      if (nextRemember) {
        localStorage.setItem("memberNickname", nextNickname);
        localStorage.setItem("memberUserId", nextUserId);
        localStorage.setItem("rememberMember", "true");
      } else {
        localStorage.removeItem("memberNickname");
        localStorage.removeItem("memberUserId");
        localStorage.removeItem("rememberMember");
      }

      await loadEntries(nextNickname, nextUserId);

      const checkResponse = await fetch(
        `/api/entries?nickname=${encodeURIComponent(nextNickname)}&userId=${encodeURIComponent(nextUserId)}`,
        { cache: "no-store" }
      );
      const checkData = await checkResponse.json();

      if (checkResponse.ok && checkData.ok && checkData.alreadyParticipated) {
        setSuccessMessage("오늘은 이미 참여완료 했어요.");
        setShowCollectedSection(true);
      }
    } catch (error) {
      console.error(error);
      setAuthMessage("회원 확인 중 오류가 발생했습니다.");
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    const savedNickname = localStorage.getItem("memberNickname");
    const savedUserId = localStorage.getItem("memberUserId");
    const savedRemember = localStorage.getItem("rememberMember");

    if (savedRemember === "true" && savedNickname && savedUserId) {
      setNickname(savedNickname);
      setUserId(savedUserId);
      setRememberMe(true);

      setTimeout(() => {
        handleVerifyMember(savedNickname, savedUserId, true);
      }, 200);
    } else {
      loadEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMinutes(getSeoulNowMinutes());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

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

    if (formType === "skip" && !itemStatus.canUseSkip) {
      setErrorMessage("보유하고 있는 스킵권이 없습니다.");
      return;
    }

    if (formType === "twofeed" && !itemStatus.canUseTwofeed) {
      setErrorMessage("보유하고 있는 투피드권이 없습니다.");
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
          link1: requiresLink1 ? cleanInstagramLink(link1.trim()) : "",
link2: requiresLink2 ? cleanInstagramLink(link2.trim()) : "",
          isReels1: requiresLink1 ? isReels1 : false,
          isReels2: requiresLink2 ? isReels2 : false,
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

      resetLinks();

      await loadEntries(nickname, userId);
    } catch (error) {
      console.error(error);
      setErrorMessage("접수 중 오류가 발생했습니다.");
    }
  };

  const sortedSubmissions = useMemo(() => {
    return [...submissions].sort((a, b) => {
      const typeA = a.form_type || a.formType;
      const typeB = b.form_type || b.formType;

      const isStaffA = typeA === "staff";
      const isStaffB = typeB === "staff";

      if (isStaffA && !isStaffB) return -1;
      if (!isStaffA && isStaffB) return 1;

      const timeA = new Date(a.created_at || a.createdAt || "").getTime();
      const timeB = new Date(b.created_at || b.createdAt || "").getTime();

      return timeA - timeB;
    });
  }, [submissions]);

  const formattedCollectedText = useMemo(() => {
    const staffCount = sortedSubmissions.filter(
      (item) => (item.form_type || item.formType) === "staff"
    ).length;

    return sortedSubmissions
      .map((item, index) => {
        const type = item.form_type || item.formType;
        const isStaff = type === "staff";

        const displayIndex = isStaff ? 0 : index - staffCount + 1;

        let typeLabel = "";
        if (type === "skip") typeLabel = " (스킵)";
        else if (type === "twofeed") typeLabel = " (투피드)";
        else if (type === "volunteer") typeLabel = " (봉사)";
        else if (type === "nofeed") typeLabel = " (노피드)";
        else if (type === "sub-feed") typeLabel = " (부계 피드/릴스)";
        else if (type === "sub-nofeed") typeLabel = " (부계 노피드)";
        else if (type === "sub-volunteer") typeLabel = " (부계 봉사)";

        let reelsCount = 0;
        if (item.is_reels1) reelsCount++;
        if (item.is_reels2) reelsCount++;

        const reelsLabel = reelsCount === 0 ? "" : ` (${reelsCount} 릴스)`;

        const lines = [`${displayIndex}. ${item.nickname}${typeLabel}${reelsLabel}`];

        if (item.link1) lines.push(item.link1);
        if (item.link2) lines.push(item.link2);

        return lines.join("\n");
      })
      .join("\n\n");
  }, [sortedSubmissions]);

  const handleCopyCollectedText = async () => {
    try {
      await navigator.clipboard.writeText(formattedCollectedText);
      setCopyMessage("복사되었습니다.");
      setTimeout(() => setCopyMessage(""), 2000);
    } catch (error) {
      console.error(error);
      setCopyMessage("복사에 실패했습니다.");
      setTimeout(() => setCopyMessage(""), 2000);
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

  const copyButtonStyle: React.CSSProperties = {
    border: "1px solid #e7dfd3",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "#ffffff",
    color: "#2a2a2a",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 800 }}>
              현재까지 취합된 링크
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {copyMessage ? (
                <span style={{ fontSize: "12px", color: "#6d665d", fontWeight: 700 }}>
                  {copyMessage}
                </span>
              ) : null}
              <button type="button" onClick={handleCopyCollectedText} style={copyButtonStyle}>
                전체 복사
              </button>
            </div>
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
          ) : sortedSubmissions.length === 0 ? (
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
              {formattedCollectedText}
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
                setItemStatus({
                  canUseSkip: false,
                  canUseTwofeed: false,
                  skipOwnedCount: 0,
                  twofeedOwnedCount: 0,
                });
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
                setItemStatus({
                  canUseSkip: false,
                  canUseTwofeed: false,
                  skipOwnedCount: 0,
                  twofeedOwnedCount: 0,
                });
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
            onClick={() => handleVerifyMember()}
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
                    onClick={() => !isSkipClosed && itemStatus.canUseSkip && handleTabChange("skip")}
                    style={toggleButtonStyle(formType === "skip", isSkipClosed || !itemStatus.canUseSkip)}
                    disabled={isSkipClosed || !itemStatus.canUseSkip}
                  >
                    스킵
                  </button>
                  <button
                    type="button"
                    onClick={() => itemStatus.canUseTwofeed && handleTabChange("twofeed")}
                    style={toggleButtonStyle(formType === "twofeed", !itemStatus.canUseTwofeed)}
                    disabled={!itemStatus.canUseTwofeed}
                  >
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
                          setIsReels2(false);
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

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "14px",
                        marginTop: "10px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isReels1}
                        onChange={(e) => setIsReels1(e.target.checked)}
                      />
                      릴스
                    </label>
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

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "14px",
                        marginTop: "10px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isReels2}
                        onChange={(e) => setIsReels2(e.target.checked)}
                      />
                      릴스
                    </label>
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