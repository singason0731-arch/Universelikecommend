"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

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
  user_id?: string;
  userId?: string;
  form_type?: FormType;
  formType?: FormType;
  link1: string;
  link2: string;
  created_at?: string;
  createdAt?: string;
  is_reels1?: boolean;
  is_reels2?: boolean;
  is_public1?: boolean;
  is_public2?: boolean;
  completed_at?: string | null;
  completedAt?: string | null;
};

type ItemStatus = {
  canUseSkip: boolean;
  canUseTwofeed: boolean;
  skipOwnedCount: number;
  twofeedOwnedCount: number;
};

type SavedProfile = {
  nickname: string;
  userId: string;
};

type QuickLoginPromptState = {
  nickname: string;
  userId: string;
} | null;

const SKIP_LIMIT = 7;
const OPEN_TIME = "14:30";
const CLOSE_TIME = "22:00";
const ADMIN_PASSWORD = "0000";
const THEME_STORAGE_KEY = "preferredTheme";
const MEMBER_PROFILES_STORAGE_KEY = "memberProfiles";
const ACTIVE_MEMBER_PROFILE_KEY = "activeMemberProfile";

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

function getCurrentSessionKey() {
  const now = new Date();
  const dateText = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const currentMinutes = getSeoulNowMinutes();

  if (currentMinutes >= parseTimeToMinutes(OPEN_TIME)) {
    return dateText;
  }

  const yesterday = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  yesterday.setDate(yesterday.getDate() - 1);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(yesterday);
}

function normalizeMemberUserId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function getProfileKey(nickname: string, userId: string) {
  return `${nickname.trim()}::${normalizeMemberUserId(userId)}`;
}

export default function Home() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [formType, setFormType] = useState<FormType>("feed");
  const [nickname, setNickname] = useState("");
  const [userId, setUserId] = useState("");
  const [link1, setLink1] = useState("");
  const [link2, setLink2] = useState("");
  const [isReels1, setIsReels1] = useState(false);
  const [isReels2, setIsReels2] = useState(false);
  const [isPublic1, setIsPublic1] = useState(false);
  const [isPublic2, setIsPublic2] = useState(false);
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
  const [currentSessionKey, setCurrentSessionKey] = useState(getCurrentSessionKey());
  const [alreadyParticipatedToday, setAlreadyParticipatedToday] = useState(false);
  const [completingEntryId, setCompletingEntryId] = useState<string | number | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | number | null>(null);
  const [editingLink1, setEditingLink1] = useState("");
  const [editingLink2, setEditingLink2] = useState("");
  const [isSavingAdminEdit, setIsSavingAdminEdit] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [quickLoginPrompt, setQuickLoginPrompt] = useState<QuickLoginPromptState>(null);
  const lastLoadedSessionKeyRef = useRef(currentSessionKey);
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
  const isCompletionWindowOpen =
    nowMinutes >= closeMinutes || nowMinutes < openMinutes;
  const isPublicCollectedWindowOpen =
    nowMinutes >= closeMinutes || nowMinutes < openMinutes;
  const isMemberCollectedWindowOpen =
    nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  const canViewCollected =
    isAdminMode ||
    isPublicCollectedWindowOpen ||
    (isVerified && isMemberCollectedWindowOpen);
  const normalizedCurrentUserId = normalizeMemberUserId(userId);
  const completionWindowMessage =
    "오후 10시부터 다음날 오후 2시 30분 전까지 가능";
  const isDarkMode = themeMode === "dark";

  const theme = {
    pageBackground: isDarkMode
      ? "linear-gradient(180deg, #14181d 0%, #11151a 45%, #0c1014 100%)"
      : "linear-gradient(180deg, #fffdf9 0%, #fffaf3 40%, #ffffff 100%)",
    cardBackground: isDarkMode ? "#171d24" : "#ffffff",
    cardBorder: isDarkMode ? "#27303a" : "#f1ede7",
    cardShadow: isDarkMode ? "0 10px 24px rgba(0,0,0,0.28)" : "0 6px 18px rgba(0,0,0,0.03)",
    text: isDarkMode ? "#f4efe8" : "#1f1f1f",
    mutedText: isDarkMode ? "#ddd3c3" : "#6d665d",
    subText: isDarkMode ? "#d2c7b8" : "#7b6f60",
    inputBackground: isDarkMode ? "#10151b" : "#fffdfb",
    inputBorder: isDarkMode ? "#33404d" : "#e5ddd2",
    chipBackground: isDarkMode ? "#1d252d" : "#f7f2ea",
    chipBorder: isDarkMode ? "#344150" : "#eee4d3",
    primary: isDarkMode ? "#f3ede3" : "#1f1f1f",
    primaryText: isDarkMode ? "#13171c" : "#ffffff",
    secondaryBackground: isDarkMode ? "#171d24" : "#ffffff",
    secondaryBorder: isDarkMode ? "#33404d" : "#e7dfd3",
    secondaryText: isDarkMode ? "#ece5d8" : "#2a2a2a",
    panelBackground: isDarkMode ? "#16202a" : "#faf7f3",
    panelBorder: isDarkMode ? "#2b3642" : "#e7ddd0",
    dashedBorder: isDarkMode ? "#394654" : "#e7ddd0",
    successBg: isDarkMode ? "#163022" : "#f4fbf5",
    successBorder: isDarkMode ? "#2d5b42" : "#d7edd9",
    successText: isDarkMode ? "#c6f1d2" : "#2b4d30",
    errorBg: isDarkMode ? "#34191b" : "#fff4f4",
    errorBorder: isDarkMode ? "#6a3034" : "#f2d1d1",
    errorText: isDarkMode ? "#ffcdcd" : "#6e2f2f",
    articleBackground: isDarkMode ? "#131921" : "#fffdfa",
    articleBorder: isDarkMode ? "#2c3743" : "#eee7dd",
    dimmedText: isDarkMode ? "#b7ad9f" : "#9b978f",
  };

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
    setIsPublic1(false);
    setIsPublic2(false);
    setStaffLinkCount("1");
  };

  const resetAdminEditing = () => {
    setEditingEntryId(null);
    setEditingLink1("");
    setEditingLink2("");
    setIsSavingAdminEdit(false);
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
    feed: "게시물 링크 1개 등록",
    volunteer: "링크 작성 없이 신청",
    skip: "내 게시물 링크를 등록하고 품앗이 참여는 스킵",
    twofeed: "게시물 링크 2개를 작성",
    nofeed: "링크 작성 없이 신청",
    "sub-feed": "부계 게시물 링크 1개를 작성",
    "sub-nofeed": "링크 작성 없이 신청",
    "sub-volunteer": "부계 봉사 신청",
    staff: "링크 1개 또는 2개까지 선택 작성 가능",
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

  const getStoredQuickLoginProfiles = () => {
    if (typeof window === "undefined") return savedProfiles;

    const storedProfiles = localStorage.getItem(MEMBER_PROFILES_STORAGE_KEY);

    if (!storedProfiles) return savedProfiles;

    try {
      const parsedProfiles = JSON.parse(storedProfiles) as SavedProfile[];
      if (!Array.isArray(parsedProfiles)) return savedProfiles;

      return parsedProfiles.filter(
        (profile) => profile?.nickname?.trim() && profile?.userId?.trim()
      );
    } catch (error) {
      console.error(error);
      return savedProfiles;
    }
  };

  const saveQuickLoginProfile = (profile: SavedProfile, sourceProfiles = savedProfiles) => {
    const normalizedProfile = {
      nickname: profile.nickname.trim(),
      userId: normalizeMemberUserId(profile.userId),
    };

    const nextProfiles = [
      normalizedProfile,
      ...sourceProfiles.filter(
        (savedProfile) =>
          getProfileKey(savedProfile.nickname, savedProfile.userId) !==
          getProfileKey(normalizedProfile.nickname, normalizedProfile.userId)
      ),
    ].slice(0, 6);

    setSavedProfiles(nextProfiles);
    localStorage.setItem(MEMBER_PROFILES_STORAGE_KEY, JSON.stringify(nextProfiles));
    localStorage.setItem(
      ACTIVE_MEMBER_PROFILE_KEY,
      getProfileKey(normalizedProfile.nickname, normalizedProfile.userId)
    );
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
    setQuickLoginPrompt(null);
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
    const normalizedNextUserId = normalizeMemberUserId(nextUserId);
    const nextProfileKey = getProfileKey(nextNickname, normalizedNextUserId);
    const storedQuickLoginProfiles = getStoredQuickLoginProfiles();
    const alreadySavedProfile = storedQuickLoginProfiles.some(
      (profile) => getProfileKey(profile.nickname, profile.userId) === nextProfileKey
    );

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
        setAuthMessage(data.message || "멤버 인증에 실패했습니다.");
        setIsVerified(false);
        return;
      }

      setAuthMessage("멤버 인증이 완료되었습니다.");
      setIsVerified(true);

      if (data.itemStatus) {
        setItemStatus(data.itemStatus);
      }

      if (nextRemember) {
        localStorage.setItem("memberNickname", nextNickname);
        localStorage.setItem("memberUserId", nextUserId);
        localStorage.setItem("rememberMember", "true");

        const nextProfile = {
          nickname: nextNickname,
          userId: normalizedNextUserId,
        };

        if (alreadySavedProfile || storedQuickLoginProfiles.length === 0) {
          saveQuickLoginProfile(nextProfile, storedQuickLoginProfiles);
        } else {
          setQuickLoginPrompt(nextProfile);
          localStorage.removeItem(ACTIVE_MEMBER_PROFILE_KEY);
        }
      } else {
        localStorage.removeItem("memberNickname");
        localStorage.removeItem("memberUserId");
        localStorage.removeItem("rememberMember");

        if (alreadySavedProfile) {
          localStorage.setItem(ACTIVE_MEMBER_PROFILE_KEY, nextProfileKey);
        }
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
      setAuthMessage("인증에 오류가 발생했습니다.");
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const savedNickname = localStorage.getItem("memberNickname");
    const savedUserId = localStorage.getItem("memberUserId");
    const savedRemember = localStorage.getItem("rememberMember");
    const storedProfiles = localStorage.getItem(MEMBER_PROFILES_STORAGE_KEY);
    const activeProfileKey = localStorage.getItem(ACTIVE_MEMBER_PROFILE_KEY);
    let initialProfiles: SavedProfile[] = [];

    if (savedTheme === "dark" || savedTheme === "light") {
      setThemeMode(savedTheme);
    }

    if (storedProfiles) {
      try {
        const parsedProfiles = JSON.parse(storedProfiles) as SavedProfile[];
        if (Array.isArray(parsedProfiles)) {
          initialProfiles = parsedProfiles.filter(
            (profile) => profile?.nickname?.trim() && profile?.userId?.trim()
          );
          setSavedProfiles(initialProfiles);
        }
      } catch (error) {
        console.error(error);
      }
    }

    if (savedNickname && savedUserId) {
      const legacyProfile = {
        nickname: savedNickname.trim(),
        userId: normalizeMemberUserId(savedUserId),
      };
      const hasLegacyProfile = initialProfiles.some(
        (profile) =>
          getProfileKey(profile.nickname, profile.userId) ===
          getProfileKey(legacyProfile.nickname, legacyProfile.userId)
      );

      if (!hasLegacyProfile) {
        initialProfiles = [legacyProfile, ...initialProfiles].slice(0, 6);
        setSavedProfiles(initialProfiles);
        localStorage.setItem(MEMBER_PROFILES_STORAGE_KEY, JSON.stringify(initialProfiles));
      }
    }

    if (savedRemember === "true" && savedNickname && savedUserId) {
      setNickname(savedNickname);
      setUserId(savedUserId);
      setRememberMe(true);

      setTimeout(() => {
        handleVerifyMember(savedNickname, savedUserId, true);
      }, 200);
    } else if (activeProfileKey) {
      const activeProfile = initialProfiles.find(
        (profile) => getProfileKey(profile.nickname, profile.userId) === activeProfileKey
      );

      if (activeProfile) {
        setNickname(activeProfile.nickname);
        setUserId(activeProfile.userId);
        setRememberMe(false);

        setTimeout(() => {
          handleVerifyMember(activeProfile.nickname, activeProfile.userId, false);
        }, 200);
      } else {
        loadEntries();
      }
    } else {
      loadEntries();
    }

    localStorage.removeItem("adminMode");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMinutes(getSeoulNowMinutes());
      setCurrentSessionKey(getCurrentSessionKey());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const refreshEntriesForCurrentSession = useEffectEvent(() => {
    void loadEntries(isVerified ? nickname : undefined, isVerified ? userId : undefined);
  });

  useEffect(() => {
    if (lastLoadedSessionKeyRef.current === currentSessionKey) {
      return;
    }

    lastLoadedSessionKeyRef.current = currentSessionKey;
    setAlreadyParticipatedToday(false);
    setShowCollectedSection(false);
    setSuccessMessage("");
    setErrorMessage("");
    refreshEntriesForCurrentSession();
  }, [currentSessionKey]);

  const handleSelectSavedProfile = (profile: SavedProfile) => {
    setQuickLoginPrompt(null);
    setNickname(profile.nickname);
    setUserId(profile.userId);
    localStorage.setItem(
      ACTIVE_MEMBER_PROFILE_KEY,
      getProfileKey(profile.nickname, profile.userId)
    );
    if (rememberMe) {
      localStorage.setItem("memberNickname", profile.nickname);
      localStorage.setItem("memberUserId", profile.userId);
      localStorage.setItem("rememberMember", "true");
    }
    void handleVerifyMember(profile.nickname, profile.userId, rememberMe);
  };

  const handleRemoveSavedProfile = (profile: SavedProfile) => {
    const profileKey = getProfileKey(profile.nickname, profile.userId);
    const nextProfiles = savedProfiles.filter(
      (savedProfile) =>
        getProfileKey(savedProfile.nickname, savedProfile.userId) !==
        profileKey
    );

    setSavedProfiles(nextProfiles);
    localStorage.setItem(MEMBER_PROFILES_STORAGE_KEY, JSON.stringify(nextProfiles));

    if (
      localStorage.getItem(ACTIVE_MEMBER_PROFILE_KEY) === profileKey
    ) {
      localStorage.removeItem(ACTIVE_MEMBER_PROFILE_KEY);
    }

    const savedNickname = localStorage.getItem("memberNickname");
    const savedUserId = localStorage.getItem("memberUserId");
    const savedProfileKey =
      savedNickname && savedUserId
        ? getProfileKey(savedNickname, normalizeMemberUserId(savedUserId))
        : null;

    if (savedProfileKey === profileKey) {
      localStorage.removeItem("memberNickname");
      localStorage.removeItem("memberUserId");
      localStorage.removeItem("rememberMember");
      setRememberMe(false);
    }
  };

  const handleSaveQuickLoginChoice = (shouldSave: boolean) => {
    if (!quickLoginPrompt) return;

    if (shouldSave) {
      saveQuickLoginProfile(quickLoginPrompt);
      setAuthMessage("멤버 인증이 완료되었습니다. 간편 로그인 계정으로 저장했어요.");
    }

    if (!shouldSave) {
      setAuthMessage("멤버 인증이 완료되었습니다.");
    }

    setQuickLoginPrompt(null);
  };

  const handleSubmit = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!isVerified) {
      setErrorMessage("먼저 멤버 인증을 완료해야 합니다.");
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
          isPublic1: requiresLink1 ? isPublic1 : false,
          isPublic2: requiresLink2 ? isPublic2 : false,
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

  const getSubmissionTypeLabel = (item: SubmissionItem) => {
    const type = item.form_type || item.formType;

    if (type === "skip") return " (스킵)";
    if (type === "twofeed") return " (투피드)";
    if (type === "volunteer") return " (봉사)";
    if (type === "nofeed") return " (노피드)";
    if (type === "sub-feed") return " (부계 피드/릴스)";
    if (type === "sub-nofeed") return " (부계 노피드)";
    if (type === "sub-volunteer") return " (부계 봉사)";

    return "";
  };

  const getSubmissionReelsLabel = (item: SubmissionItem) => {
    let reelsCount = 0;
    if (item.is_reels1) reelsCount++;
    if (item.is_reels2) reelsCount++;

    return reelsCount === 0 ? "" : ` (${reelsCount} 릴스)`;
  };

  const isSubmissionCompleted = (item: SubmissionItem) =>
    Boolean(item.completed_at || item.completedAt);

  const hasSubmissionLinks = (item: SubmissionItem) =>
    Boolean(item.link1?.trim() || item.link2?.trim());

  const isOwnSubmission = (item: SubmissionItem) => {
    const entryUserId = normalizeMemberUserId(item.user_id || item.userId || "");
    return Boolean(normalizedCurrentUserId && entryUserId === normalizedCurrentUserId);
  };

  const visibleSubmissions = sortedSubmissions;

  const staffSubmissionCount = useMemo(
    () =>
      visibleSubmissions.filter((item) => (item.form_type || item.formType) === "staff")
        .length,
    [visibleSubmissions]
  );

  const getSubmissionCounts = (items: SubmissionItem[]) => {
    const counts = {
      total: items.length,
      staff: 0,
      feed: 0,
      skip: 0,
      twofeed: 0,
      nofeed: 0,
      subFeed: 0,
      subNofeed: 0,
      volunteer: 0,
    };

    items.forEach((item) => {
      const type = item.form_type || item.formType;

      if (type === "staff") counts.staff += 1;
      else if (type === "feed") counts.feed += 1;
      else if (type === "skip") counts.skip += 1;
      else if (type === "twofeed") counts.twofeed += 1;
      else if (type === "nofeed") counts.nofeed += 1;
      else if (type === "sub-feed") counts.subFeed += 1;
      else if (type === "sub-nofeed") counts.subNofeed += 1;
      else if (type === "volunteer" || type === "sub-volunteer") counts.volunteer += 1;
    });

    return counts;
  };

  const formatCollectedText = (items: SubmissionItem[], includeSummary: boolean) => {
    const counts = getSubmissionCounts(items);
    const currentStaffCount = items.filter(
      (item) => (item.form_type || item.formType) === "staff"
    ).length;
    const summaryLines = [
      `🏷총인원(${counts.total}명)`,
      `운영진(${counts.staff}명) 피드/릴스(${counts.feed}명) 스킵(${counts.skip}명) 투피드(${counts.twofeed}명) 노피드(${counts.nofeed}명) 부계 피드/릴스(${counts.subFeed}명) 부계 노피드(${counts.subNofeed}명) 봉사(${counts.volunteer}명)`,
    ];

    const entryLines = items.map((item, index) => {
      const type = item.form_type || item.formType;
      const isStaff = type === "staff";
      const displayUserId = item.user_id || item.userId || "";
      const displayIndex = isStaff ? 0 : index - currentStaffCount + 1;
      const completedLabel = isSubmissionCompleted(item) ? " (완료)" : "";
      const lines = [
        `${displayIndex}. ${item.nickname}${displayUserId ? ` ${displayUserId}` : ""}${completedLabel}`,
      ];

      if (item.link1) lines.push(item.link1);
      if (item.link2) lines.push(item.link2);

      return lines.join("\n");
    });

    if (!includeSummary) {
      return entryLines.join("\n\n");
    }

    return [...summaryLines, "", ...entryLines].join("\n\n");
  };

  const formattedCollectedText = formatCollectedText(visibleSubmissions, false);
  const formattedAdminCollectedText = formatCollectedText(sortedSubmissions, true);

  const handleAdminModeSubmit = () => {
    if (adminPassword !== ADMIN_PASSWORD) {
      setErrorMessage("운영진 비밀번호가 올바르지 않습니다.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("운영진 모드가 활성화되었습니다.");
    setIsAdminMode(true);
    setShowAdminPanel(true);
  };

  const handleAdminModeExit = () => {
    setIsAdminMode(false);
    setAdminPassword("");
    resetAdminEditing();
  };

  const handleStartAdminEdit = (item: SubmissionItem) => {
    setEditingEntryId(item.id);
    setEditingLink1(item.link1 || "");
    setEditingLink2(item.link2 || "");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleSaveAdminEdit = async (item: SubmissionItem) => {
    if (!isAdminMode) {
      setErrorMessage("운영진 모드에서만 링크를 수정할 수 있습니다.");
      return;
    }

    if (!adminPassword) {
      setErrorMessage("운영진 비밀번호를 다시 확인해 주세요.");
      return;
    }

    if (editingLink1.trim() && !isValidUrl(editingLink1.trim())) {
      setErrorMessage("첫 번째 링크 형식이 올바르지 않습니다.");
      return;
    }

    if (editingLink2.trim() && !isValidUrl(editingLink2.trim())) {
      setErrorMessage("두 번째 링크 형식이 올바르지 않습니다.");
      return;
    }

    try {
      setIsSavingAdminEdit(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch("/api/entries", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update",
          entryId: item.id,
          adminPassword,
          link1: editingLink1.trim() ? cleanInstagramLink(editingLink1.trim()) : "",
          link2: editingLink2.trim() ? cleanInstagramLink(editingLink2.trim()) : "",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setErrorMessage(data.message || "운영진 링크 수정 중 오류가 발생했습니다.");
        return;
      }

      const nextLink1 = editingLink1.trim() ? cleanInstagramLink(editingLink1.trim()) : "";
      const nextLink2 = editingLink2.trim() ? cleanInstagramLink(editingLink2.trim()) : "";

      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === item.id
            ? {
                ...submission,
                link1: nextLink1,
                link2: nextLink2,
              }
            : submission
        )
      );

      setSuccessMessage(data.message || "운영진 링크 수정이 완료되었습니다.");
      resetAdminEditing();
      await loadEntries(nickname, userId);
    } catch (error) {
      console.error(error);
      setErrorMessage("운영진 링크 수정 중 오류가 발생했습니다.");
    } finally {
      setIsSavingAdminEdit(false);
    }
  };

  const handleCompleteEntry = async (entryId: string | number) => {
    if (!isVerified) {
      setErrorMessage("멤버 인증 후 완료 처리할 수 있습니다.");
      return;
    }

    if (!isCompletionWindowOpen) {
      setErrorMessage(`완료 처리는 ${completionWindowMessage}합니다.`);
      return;
    }

    try {
      setCompletingEntryId(entryId);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch("/api/entries", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entryId,
          userId: normalizedCurrentUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setErrorMessage(data.message || "완료 처리 중 오류가 발생했습니다.");
        return;
      }

      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === entryId
            ? {
                ...submission,
                completed_at: new Date().toISOString(),
              }
            : submission
        )
      );

      setSuccessMessage(data.message || "완료 처리되었습니다.");
      await loadEntries(nickname, userId);
    } catch (error) {
      console.error(error);
      setErrorMessage("완료 처리 중 오류가 발생했습니다.");
    } finally {
      setCompletingEntryId(null);
    }
  };

  const handleAdminUndoComplete = async (entryId: string | number) => {
    if (!isAdminMode) {
      setErrorMessage("운영진 모드에서만 완료 해제가 가능합니다.");
      return;
    }

    if (!adminPassword) {
      setErrorMessage("운영진 비밀번호를 다시 확인해 주세요.");
      return;
    }

    try {
      setCompletingEntryId(entryId);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch("/api/entries", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "uncomplete",
          entryId,
          adminPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setErrorMessage(data.message || "완료 해제 중 오류가 발생했습니다.");
        return;
      }

      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === entryId
            ? {
                ...submission,
                completed_at: null,
                completedAt: null,
              }
            : submission
        )
      );

      setSuccessMessage(data.message || "운영진이 완료 상태를 해제했습니다.");
      await loadEntries(nickname, userId);
    } catch (error) {
      console.error(error);
      setErrorMessage("완료 해제 중 오류가 발생했습니다.");
    } finally {
      setCompletingEntryId(null);
    }
  };

  const handleAdminComplete = async (entryId: string | number) => {
    if (!isAdminMode) {
      setErrorMessage("운영진 모드에서만 완료 체크가 가능합니다.");
      return;
    }

    if (!adminPassword) {
      setErrorMessage("운영진 비밀번호를 다시 확인해 주세요.");
      return;
    }

    try {
      setCompletingEntryId(entryId);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch("/api/entries", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "complete_admin",
          entryId,
          adminPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setErrorMessage(data.message || "완료 체크 중 오류가 발생했습니다.");
        return;
      }

      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === entryId
            ? {
                ...submission,
                completed_at: new Date().toISOString(),
              }
            : submission
        )
      );

      setSuccessMessage(data.message || "운영진이 완료 상태를 체크했습니다.");
      await loadEntries(nickname, userId);
    } catch (error) {
      console.error(error);
      setErrorMessage("완료 체크 중 오류가 발생했습니다.");
    } finally {
      setCompletingEntryId(null);
    }
  };

  const handleCopyCollectedText = async () => {
    try {
      await navigator.clipboard.writeText(
        isAdminMode ? formattedAdminCollectedText : formattedCollectedText
      );
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
    background: theme.pageBackground,
    padding: "18px 12px 40px",
    fontFamily:
      'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: theme.text,
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "520px",
    margin: "0 auto",
  };

  const cardStyle: React.CSSProperties = {
    background: theme.cardBackground,
    border: `1px solid ${theme.cardBorder}`,
    borderRadius: "22px",
    padding: "18px 16px",
    boxShadow: theme.cardShadow,
    marginBottom: "14px",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 14px",
    borderRadius: "14px",
    border: `1px solid ${theme.inputBorder}`,
    outline: "none",
    fontSize: "15px",
    background: theme.inputBackground,
    color: theme.text,
    boxSizing: "border-box",
    minHeight: "48px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 700,
    marginBottom: "8px",
    color: theme.text,
  };

  const toggleWrapStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  };

  const toggleButtonStyle = (active: boolean, disabled = false): React.CSSProperties => ({
    padding: "12px 14px",
    borderRadius: "14px",
    border: active ? `1px solid ${theme.primary}` : `1px solid ${theme.secondaryBorder}`,
    background: disabled ? theme.panelBackground : active ? theme.primary : theme.secondaryBackground,
    color: disabled ? theme.dimmedText : active ? theme.primaryText : theme.secondaryText,
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
    background: theme.primary,
    color: theme.primaryText,
    fontSize: "16px",
    fontWeight: 800,
    cursor: "pointer",
    minHeight: "54px",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    width: "100%",
    border: `1px solid ${theme.secondaryBorder}`,
    borderRadius: "18px",
    padding: "15px 18px",
    background: theme.secondaryBackground,
    color: theme.secondaryText,
    fontSize: "15px",
    fontWeight: 800,
    cursor: "pointer",
    minHeight: "52px",
    marginTop: "12px",
  };

  const copyButtonStyle: React.CSSProperties = {
    border: `1px solid ${theme.secondaryBorder}`,
    borderRadius: "12px",
    padding: "10px 12px",
    background: theme.secondaryBackground,
    color: theme.secondaryText,
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  };

  const checkboxRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap",
    marginTop: "10px",
  };

  const checkboxLabelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
  };

  const messageBox = (bg: string, border: string): React.CSSProperties => ({
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: "18px",
    padding: "15px 16px",
    marginBottom: "14px",
  });

  const getCollectedAccessMessage = () => {
    if (isAdminMode) {
      return "운영진 모드에서는 링크 확인, 취합, 수정이 가능합니다.";
    }

    if (isPublicCollectedWindowOpen) {
      return "오후 10시 이후에는 로그인 없이도 취합된 링크를 확인할 수 있습니다.";
    }

    if (nowMinutes < openMinutes) {
      return "취합된 링크는 오후 2시 30분부터 확인할 수 있습니다.";
    }

    return "오후 2시 30분부터 오후 10시 전까지는 로그인한 멤버만 취합된 링크를 확인할 수 있습니다.";
  };

  const renderCollectedSection = () => (
    <section style={{ ...cardStyle, marginTop: "12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "8px",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 800 }}>
          취합된 링크 확인
        </div>

        <button
          type="button"
          onClick={() => setShowAdminPanel((prev) => !prev)}
          style={copyButtonStyle}
        >
          운영진
        </button>
      </div>

      <div
        style={{
          fontSize: "13px",
          color: theme.mutedText,
          lineHeight: 1.7,
          fontWeight: 600,
          marginBottom: canViewCollected ? "12px" : "0",
        }}
      >
        {getCollectedAccessMessage()}
      </div>

      {showAdminPanel ? (
        <div
          style={{
            marginTop: "12px",
            padding: "14px",
            borderRadius: "16px",
            background: isAdminMode ? theme.chipBackground : theme.panelBackground,
            border: `1px solid ${isAdminMode ? theme.chipBorder : theme.panelBorder}`,
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 800, marginBottom: "8px" }}>
            운영진 모드
          </div>

          {isAdminMode ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: "13px", color: theme.mutedText, lineHeight: 1.6, fontWeight: 600 }}>
                운영진 모드가 활성화되었습니다. 링크 수정은 상시 가능하고, 완 선택/해제는 {completionWindowMessage}합니다.
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={handleAdminModeExit} style={copyButtonStyle}>
                  운영진 모드 종료
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminPanel(false)}
                  style={copyButtonStyle}
                >
                  닫기
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: "13px", color: theme.mutedText, lineHeight: 1.6, fontWeight: 600 }}>
                운영진 비밀번호를 입력하면 모든 링크를 수정할 수 있습니다.
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "10px",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="운영진 비밀번호"
                  style={{ ...inputStyle, flex: "1 1 220px", minHeight: "46px" }}
                />
                <button type="button" onClick={handleAdminModeSubmit} style={copyButtonStyle}>
                  운영진 모드 열기
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminPanel(false)}
                  style={copyButtonStyle}
                >
                  닫기
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {!canViewCollected ? null : (
        <>
          <button
            type="button"
            onClick={() => setShowCollectedSection((prev) => !prev)}
            style={secondaryButtonStyle}
          >
            {showCollectedSection ? "취합된 링크 접기" : "현재까지 취합된 링크 확인하기"}
          </button>

          {showCollectedSection && (
            <section style={{ marginTop: "12px" }}>
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
                    <span style={{ fontSize: "12px", color: theme.mutedText, fontWeight: 700 }}>
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
                    background: theme.panelBackground,
                    border: `1px dashed ${theme.dashedBorder}`,
                    fontSize: "14px",
                    color: theme.mutedText,
                    lineHeight: 1.6,
                  }}
                >
                  취합된 링크를 불러오는 중입니다.
                </div>
              ) : visibleSubmissions.length === 0 ? (
                <div
                  style={{
                    padding: "15px 14px",
                    borderRadius: "16px",
                    background: theme.panelBackground,
                    border: `1px dashed ${theme.dashedBorder}`,
                    fontSize: "14px",
                    color: theme.mutedText,
                    lineHeight: 1.6,
                  }}
                >
                  {isAdminMode
                    ? "아직 제출된 링크가 없습니다."
                    : "아직 취합된 링크가 없습니다."}
                </div>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {visibleSubmissions.map((item, index) => {
                    const type = item.form_type || item.formType;
                    const isStaff = type === "staff";
                    const currentStaffCount = isAdminMode
                      ? sortedSubmissions.filter(
                          (submission) =>
                            (submission.form_type || submission.formType) === "staff"
                        ).length
                      : staffSubmissionCount;
                    const displayIndex = isStaff ? 0 : index - currentStaffCount + 1;
                    const displayUserId = item.user_id || item.userId || "";
                    const typeLabel = getSubmissionTypeLabel(item);
                    const publicLabel =
                      item.is_public1 || item.is_public2 ? " (공게)" : "";
                    const reelsLabel = getSubmissionReelsLabel(item);
                    const isCompleted = isSubmissionCompleted(item);
                    const isOwnItem = isOwnSubmission(item);
                    const hasLinks = hasSubmissionLinks(item);
                    const canCompleteThisItem =
                      isOwnItem && hasLinks && isCompletionWindowOpen && !isCompleted;
                    const canAdminToggleThisItem =
                      isAdminMode && hasLinks && isCompletionWindowOpen;
                    const mutedTextStyle: React.CSSProperties = isCompleted
                      ? {
                          color: theme.dimmedText,
                          textDecoration: "line-through",
                        }
                      : {
                          color: theme.text,
                        };

                    return (
                      <article
                        key={String(item.id)}
                        style={{
                          background: theme.articleBackground,
                          border: `1px solid ${theme.articleBorder}`,
                          borderRadius: "16px",
                          padding: "14px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "12px",
                            marginBottom: hasSubmissionLinks(item) ? "10px" : "0",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ fontSize: "14px", fontWeight: 800, lineHeight: 1.7 }}>
                            <span style={isCompleted ? { color: theme.dimmedText } : undefined}>
                              {displayIndex}. {item.nickname}
                              {displayUserId ? ` ${displayUserId}` : ""}
                              {typeLabel}
                              {publicLabel}
                              {reelsLabel}
                            </span>
                          </div>

                          {!isAdminMode && isOwnItem && hasLinks ? (
                            isCompleted ? null : canCompleteThisItem ? (
                              <button
                                type="button"
                                onClick={() => handleCompleteEntry(item.id)}
                                disabled={completingEntryId === item.id}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  border: "none",
                                  padding: "0",
                                  background: "transparent",
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  lineHeight: 1.2,
                                  minWidth: "auto",
                                  color:
                                    completingEntryId === item.id ? theme.dimmedText : theme.mutedText,
                                  cursor:
                                    completingEntryId === item.id ? "not-allowed" : "pointer",
                                }}
                              >
                                <span
                                  style={{
                                    width: "21px",
                                    height: "21px",
                                    borderRadius: "4px",
                                    border: `1px solid ${
                                      completingEntryId === item.id ? theme.panelBorder : theme.mutedText
                                    }`,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "11px",
                                    background:
                                      completingEntryId === item.id ? theme.panelBackground : theme.articleBackground,
                                    color:
                                      completingEntryId === item.id ? theme.dimmedText : theme.mutedText,
                                    flexShrink: 0,
                                  }}
                                >
                                  {completingEntryId === item.id ? "..." : "완"}
                                </span>
                                <span>{completingEntryId === item.id ? "처리 중" : ""}</span>
                              </button>
                            ) : (
                              <div style={{ fontSize: "12px", color: theme.dimmedText, fontWeight: 700 }}>
                                {completionWindowMessage}
                              </div>
                            )
                          ) : null}

                          {canAdminToggleThisItem ? (
                            <button
                              type="button"
                              onClick={() =>
                                isCompleted
                                  ? handleAdminUndoComplete(item.id)
                                  : handleAdminComplete(item.id)
                              }
                              disabled={completingEntryId === item.id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                border: "none",
                                padding: "0",
                                background: "transparent",
                                fontSize: "13px",
                                fontWeight: 700,
                                lineHeight: 1.2,
                                minWidth: "auto",
                                color:
                                  completingEntryId === item.id ? theme.dimmedText : theme.mutedText,
                                cursor:
                                  completingEntryId === item.id ? "not-allowed" : "pointer",
                              }}
                            >
                              <span
                                style={{
                                  width: "21px",
                                  height: "21px",
                                  borderRadius: "4px",
                                  border: `1px solid ${
                                    completingEntryId === item.id ? theme.panelBorder : theme.mutedText
                                  }`,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "11px",
                                  background:
                                    completingEntryId === item.id
                                      ? theme.panelBackground
                                      : isCompleted
                                      ? theme.panelBackground
                                      : theme.articleBackground,
                                  color:
                                    completingEntryId === item.id ? theme.dimmedText : theme.mutedText,
                                  flexShrink: 0,
                                }}
                              >
                                {completingEntryId === item.id ? "..." : "완"}
                              </span>
                              <span>
                                {completingEntryId === item.id
                                  ? isCompleted
                                    ? "해제 중"
                                    : "처리 중"
                                  : ""}
                              </span>
                            </button>
                          ) : isAdminMode && hasLinks ? (
                            <div style={{ fontSize: "12px", color: theme.dimmedText, fontWeight: 700 }}>
                              {completionWindowMessage}
                            </div>
                          ) : null}

                          {isAdminMode && hasSubmissionLinks(item) ? (
                            editingEntryId === item.id ? (
                              <div style={{ fontSize: "12px", color: theme.subText, fontWeight: 800 }}>
                                수정 중
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartAdminEdit(item)}
                                style={copyButtonStyle}
                              >
                                운영진 수정
                              </button>
                            )
                          ) : null}
                        </div>

                        {isAdminMode && editingEntryId === item.id ? (
                          <div style={{ display: "grid", gap: "8px" }}>
                            <input
                              value={editingLink1}
                              onChange={(e) => setEditingLink1(e.target.value)}
                              placeholder="첫 번째 링크"
                              style={{ ...inputStyle, minHeight: "44px" }}
                            />

                            <input
                              value={editingLink2}
                              onChange={(e) => setEditingLink2(e.target.value)}
                              placeholder="두 번째 링크가 없으면 비워두세요"
                              style={{ ...inputStyle, minHeight: "44px" }}
                            />

                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => handleSaveAdminEdit(item)}
                                disabled={isSavingAdminEdit}
                                style={{
                                  ...copyButtonStyle,
                                  background: theme.primary,
                                  color: theme.primaryText,
                                  border: `1px solid ${theme.primary}`,
                                  cursor: isSavingAdminEdit ? "not-allowed" : "pointer",
                                }}
                              >
                                {isSavingAdminEdit ? "저장 중" : "수정 저장"}
                              </button>

                              <button
                                type="button"
                                onClick={resetAdminEditing}
                                style={copyButtonStyle}
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: "6px" }}>
                            {item.link1 ? (
                              <a
                                href={item.link1}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  ...mutedTextStyle,
                                  fontSize: "14px",
                                  lineHeight: 1.7,
                                  wordBreak: "break-all",
                                }}
                              >
                                {item.link1}
                              </a>
                            ) : null}

                            {item.link2 ? (
                              <a
                                href={item.link2}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  ...mutedTextStyle,
                                  fontSize: "14px",
                                  lineHeight: 1.7,
                                  wordBreak: "break-all",
                                }}
                              >
                                {item.link2}
                              </a>
                            ) : null}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <section style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "6px 11px",
                borderRadius: "999px",
                background: theme.chipBackground,
                fontSize: "11px",
                fontWeight: 800,
                color: theme.secondaryText,
              }}
            >
              접수 페이지
            </div>

            <button
              type="button"
              onClick={() => setThemeMode((prev) => (prev === "light" ? "dark" : "light"))}
              style={copyButtonStyle}
            >
              {isDarkMode ? "라이트모드" : "다크모드"}
            </button>
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
                background: theme.chipBackground,
                border: `1px solid ${theme.chipBorder}`,
                borderRadius: "16px",
                padding: "12px",
              }}
            >
              <div style={{ fontSize: "12px", color: theme.subText, fontWeight: 700, marginBottom: "4px" }}>
                날짜
              </div>
              <div style={{ fontSize: "14px", fontWeight: 800, lineHeight: 1.5 }}>
                {todayText}
              </div>
            </div>

            <div
              style={{
                background: theme.chipBackground,
                border: `1px solid ${theme.chipBorder}`,
                borderRadius: "16px",
                padding: "12px",
              }}
            >
              <div style={{ fontSize: "12px", color: theme.subText, fontWeight: 700, marginBottom: "4px" }}>
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
            멤버 인증
          </div>

          {savedProfiles.length > 0 ? (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ ...labelStyle, marginBottom: "10px" }}>간편 로그인</div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {savedProfiles.map((profile) => {
                  const isActiveProfile =
                    getProfileKey(profile.nickname, profile.userId) ===
                    getProfileKey(nickname, userId);

                  return (
                    <div
                      key={getProfileKey(profile.nickname, profile.userId)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 10px",
                        borderRadius: "999px",
                        background: isActiveProfile ? theme.primary : theme.chipBackground,
                        color: isActiveProfile ? theme.primaryText : theme.secondaryText,
                        border: `1px solid ${isActiveProfile ? theme.primary : theme.chipBorder}`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectSavedProfile(profile)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          fontSize: "12px",
                          fontWeight: 800,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        {profile.nickname} {profile.userId}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSavedProfile(profile)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          fontSize: "11px",
                          cursor: "pointer",
                          padding: 0,
                          opacity: 0.8,
                        }}
                      >
                        x
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div style={{ marginBottom: "12px" }}>
            <label style={labelStyle}>닉네임</label>
            <input
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setIsVerified(false);
                setAuthMessage("");
                setQuickLoginPrompt(null);
                setAlreadyParticipatedToday(false);
                setItemStatus({
                  canUseSkip: false,
                  canUseTwofeed: false,
                  skipOwnedCount: 0,
                  twofeedOwnedCount: 0,
                });
              }}
              placeholder="닉네임을 입력"
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
                setQuickLoginPrompt(null);
                setAlreadyParticipatedToday(false);
                setItemStatus({
                  canUseSkip: false,
                  canUseTwofeed: false,
                  skipOwnedCount: 0,
                  twofeedOwnedCount: 0,
                });
              }}
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
              onChange={(e) => {
                const nextChecked = e.target.checked;
                setRememberMe(nextChecked);

                if (!nextChecked) {
                  localStorage.removeItem("memberNickname");
                  localStorage.removeItem("memberUserId");
                  localStorage.removeItem("rememberMember");
                }
              }}
            />
            자동 로그인
          </label>

          <button
            type="button"
            onClick={() => handleVerifyMember()}
            style={primaryButtonStyle}
            disabled={isVerifying}
          >
            {isVerifying ? "확인 중입니다." : "멤버 인증하기"}
          </button>

          {authMessage && (
            <div
              style={{
                marginTop: "12px",
                ...messageBox(
                  isVerified ? theme.successBg : theme.errorBg,
                  isVerified ? theme.successBorder : theme.errorBorder
                ),
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  lineHeight: 1.6,
                  fontWeight: 700,
                  color: isVerified ? theme.successText : theme.errorText,
                }}
              >
                {authMessage}
              </div>
            </div>
          )}

          {quickLoginPrompt ? (
            <div
              style={{
                marginTop: "12px",
                ...messageBox(theme.panelBackground, theme.panelBorder),
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  lineHeight: 1.6,
                  fontWeight: 700,
                  color: theme.text,
                  marginBottom: "12px",
                }}
              >
                간편 로그인 계정으로 저장하시겠습니까?
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleSaveQuickLoginChoice(true)}
                  style={copyButtonStyle}
                >
                  예
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveQuickLoginChoice(false)}
                  style={copyButtonStyle}
                >
                  아니오
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section
          style={{
            ...cardStyle,
            background: isVerified ? theme.chipBackground : theme.panelBackground,
            border: `1px solid ${isVerified ? theme.chipBorder : theme.panelBorder}`,
          }}
        >
          <div>
            <div style={{ fontSize: "12px", color: theme.subText, marginBottom: "4px", fontWeight: 700 }}>
              스킵 현황
            </div>
            <div style={{ fontSize: "17px", fontWeight: 900, lineHeight: 1.45 }}>
              {isSkipClosed
                ? "스킵 신청이 마감되었습니다."
                : `스킵 사용 가능 인원 : ${skipRemainingCount}명`}
            </div>
          </div>
        </section>

        {successMessage && (
          <section style={messageBox(theme.successBg, theme.successBorder)}>
            <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "6px", color: theme.successText }}>
              제출 완료
            </div>
            <div style={{ fontSize: "14px", lineHeight: 1.6, color: theme.successText, fontWeight: 600 }}>
              {successMessage}
            </div>
          </section>
        )}

        {errorMessage && (
          <section style={messageBox(theme.errorBg, theme.errorBorder)}>
            <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "6px", color: theme.errorText }}>
              확인 필요
            </div>
            <div style={{ fontSize: "14px", lineHeight: 1.6, color: theme.errorText, fontWeight: 600 }}>
              {errorMessage}
            </div>
          </section>
        )}

        {isVerified ? (
          alreadyParticipatedToday ? (
            <>
              <section style={cardStyle}>
                <div style={{ fontSize: "14px", lineHeight: 1.7, color: theme.mutedText, fontWeight: 600 }}>
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
                  참여 유형 선택
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
                  <div style={{ fontSize: "13px", color: theme.subText, lineHeight: 1.6 }}>
                    {formDescMap[formType]}
                  </div>
                </div>

                <div
                  style={{
                    background: theme.panelBackground,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: "16px",
                    padding: "14px",
                    marginBottom: "16px",
                    fontSize: "13px",
                    color: theme.mutedText,
                    lineHeight: 1.6,
                    fontWeight: 600,
                  }}
                >
                  신청 후 링크 수정 불가
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
                          setIsPublic2(false);
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
                      placeholder="링크를 입력하세요"
                      style={inputStyle}
                    />

                    <div style={checkboxRowStyle}>
                      <label style={checkboxLabelStyle}>
                        <input
                          type="checkbox"
                          checked={isReels1}
                          onChange={(e) => setIsReels1(e.target.checked)}
                        />
                        릴스
                      </label>

                      <label style={checkboxLabelStyle}>
                        <input
                          type="checkbox"
                          checked={isPublic1}
                          onChange={(e) => setIsPublic1(e.target.checked)}
                        />
                        공게
                      </label>
                    </div>
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

                    <div style={checkboxRowStyle}>
                      <label style={checkboxLabelStyle}>
                        <input
                          type="checkbox"
                          checked={isReels2}
                          onChange={(e) => setIsReels2(e.target.checked)}
                        />
                        릴스
                      </label>

                      <label style={checkboxLabelStyle}>
                        <input
                          type="checkbox"
                          checked={isPublic2}
                          onChange={(e) => setIsPublic2(e.target.checked)}
                        />
                        공게
                      </label>
                    </div>
                  </div>
                )}

                {!requiresLink1 && !requiresLink2 && (
                  <div
                    style={{
                      padding: "15px 14px",
                      borderRadius: "16px",
                      background: theme.panelBackground,
                      border: `1px dashed ${theme.dashedBorder}`,
                      fontSize: "14px",
                      color: theme.mutedText,
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
                  background: !isFormOpen ? theme.dimmedText : theme.primary,
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
          <>
            <section style={cardStyle}>
              <div style={{ fontSize: "14px", lineHeight: 1.7, color: theme.mutedText, fontWeight: 600 }}>
                멤버 인증이 완료되어야 접수 폼이 열립니다.
                <br />
                오후 10시 전까지는 취합된 링크도 로그인한 멤버만 확인할 수 있습니다.
              </div>
            </section>

            {renderCollectedSection()}
          </>
        )}
      </div>
    </main>
  );
}
