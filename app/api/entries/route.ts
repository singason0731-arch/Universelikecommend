import { NextResponse } from "next/server";
import { hasSupabaseServiceRoleKey, supabaseServer } from "@/lib/supabase";
import {
  extractItemCount,
  getMemberRowsWithItems,
  normalizeNickname,
  normalizeUserId,
  parseIdentityCell,
} from "@/lib/googleSheets";

const SKIP_LIMIT = 7;
const WEEKLY_SKIP_LIMIT = 2;
const WEEKLY_TWOFEED_LIMIT = 3;
const OPEN_MINUTES = 14 * 60 + 30;
const CLOSE_MINUTES = 22 * 60;
const ADMIN_PASSWORD = "0000";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function buildEntryPayload(params: {
  sessionKey: string;
  nickname: string;
  userId: string;
  formType: string;
  link1: string;
  link2: string;
  isReels1: boolean;
  isReels2: boolean;
  isPublic1: boolean;
  isPublic2: boolean;
}) {
  return {
    session_key: params.sessionKey,
    nickname: params.nickname,
    user_id: params.userId,
    form_type: params.formType,
    link1: params.link1 || null,
    link2: params.link2 || null,
    is_reels1: params.isReels1,
    is_reels2: params.isReels2,
    ...(params.isPublic1 ? { is_public1: true } : {}),
    ...(params.isPublic2 ? { is_public2: true } : {}),
  };
}

function getSeoulDateTime() {
  const now = new Date();

  const seoulDate = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );

  const dateText = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const timeText = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const [hour, minute] = timeText.split(":").map(Number);
  const currentMinutes = hour * 60 + minute;

  return { now, seoulDate, dateText, currentMinutes };
}

function getSeoulDateParts(baseDate = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(baseDate);

  const year = Number(parts.find((part) => part.type === "year")?.value || "0");
  const month = Number(parts.find((part) => part.type === "month")?.value || "0");
  const day = Number(parts.find((part) => part.type === "day")?.value || "0");

  return { year, month, day };
}

function createSeoulDate(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
}

function getSessionWindow() {
  const { currentMinutes } = getSeoulDateTime();
  const baseParts = getSeoulDateParts();
  const sessionStart = createSeoulDate(
    baseParts.year,
    baseParts.month,
    baseParts.day,
    14,
    30
  );

  if (currentMinutes >= OPEN_MINUTES) {
    const nextSessionStart = new Date(sessionStart);
    nextSessionStart.setUTCDate(nextSessionStart.getUTCDate() + 1);

    return {
      sessionKey: `${baseParts.year}-${String(baseParts.month).padStart(2, "0")}-${String(baseParts.day).padStart(2, "0")}`,
      sessionStart,
      nextSessionStart,
    };
  }

  const previousSessionStart = new Date(sessionStart);
  previousSessionStart.setUTCDate(previousSessionStart.getUTCDate() - 1);
  const previousParts = getSeoulDateParts(previousSessionStart);

  return {
    sessionKey: `${previousParts.year}-${String(previousParts.month).padStart(2, "0")}-${String(previousParts.day).padStart(2, "0")}`,
    sessionStart: previousSessionStart,
    nextSessionStart: sessionStart,
  };
}

function getWeekKey() {
  const { seoulDate } = getSeoulDateTime();

  const date = new Date(seoulDate);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + diffToMonday);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${dayOfMonth}`;
}

function isFormOpen() {
  const { currentMinutes } = getSeoulDateTime();
  return currentMinutes >= OPEN_MINUTES && currentMinutes <= CLOSE_MINUTES;
}

function isCompletionWindowOpen() {
  const { currentMinutes } = getSeoulDateTime();
  return currentMinutes >= CLOSE_MINUTES || currentMinutes < OPEN_MINUTES;
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function findMatchedMemberRow(nickname: string, userId: string) {
  const rows = await getMemberRowsWithItems();

  const normalizedNickname = normalizeNickname(nickname);
  const normalizedUserId = normalizeUserId(userId);

  return rows.find((row) => {
    const parsed = parseIdentityCell(row.identityRaw);
    if (!parsed) return false;

    return (
      parsed.nickname === normalizedNickname &&
      parsed.userId === normalizedUserId
    );
  });
}

async function getWeeklyUsageCount(userId: string, itemType: "skip" | "twofeed") {
  const weekKey = getWeekKey();

  const { data, error } = await supabaseServer
    .from("item_usages")
    .select("id")
    .eq("week_key", weekKey)
    .eq("user_id", normalizeUserId(userId))
    .eq("item_type", itemType);

  if (error) throw error;

  return data?.length ?? 0;
}

async function insertWeeklyUsage(userId: string, itemType: "skip" | "twofeed") {
  const weekKey = getWeekKey();

  const { error } = await supabaseServer.from("item_usages").insert({
    week_key: weekKey,
    user_id: normalizeUserId(userId),
    item_type: itemType,
  });

  if (error) throw error;
}

async function getSkipPermission(nickname: string, userId: string) {
  const matchedRow = await findMatchedMemberRow(nickname, userId);

  if (!matchedRow) {
    return {
      ok: false,
      message: "회원 정보를 시트에서 찾을 수 없습니다.",
    };
  }

  const currentSkipCount = extractItemCount(matchedRow.skipRaw);

  if (!matchedRow.skipRaw || currentSkipCount <= 0) {
    return {
      ok: false,
      message: "보유하고 있는 스킵권이 없습니다.",
    };
  }

  const weeklyUsedCount = await getWeeklyUsageCount(userId, "skip");

  if (weeklyUsedCount >= WEEKLY_SKIP_LIMIT) {
    return {
      ok: false,
      message: "이번주 아이템 사용가능 횟수가 마감되었습니다.",
    };
  }

  return {
    ok: true,
    message: `${nickname}님의 잔여 스킵은 ${currentSkipCount - 1}개입니다.`,
  };
}

async function getTwofeedPermission(nickname: string, userId: string) {
  const matchedRow = await findMatchedMemberRow(nickname, userId);

  if (!matchedRow) {
    return {
      ok: false,
      message: "회원 정보를 시트에서 찾을 수 없습니다.",
    };
  }

  const currentTwofeedCount = extractItemCount(matchedRow.twofeedRaw);

  if (!matchedRow.twofeedRaw || currentTwofeedCount <= 0) {
    return {
      ok: false,
      message: "보유하고 있는 투피드권이 없습니다.",
    };
  }

  const weeklyUsedCount = await getWeeklyUsageCount(userId, "twofeed");

  if (weeklyUsedCount >= WEEKLY_TWOFEED_LIMIT) {
    return {
      ok: false,
      message: "이번주 아이템 사용가능 횟수가 마감되었습니다.",
    };
  }

  return {
    ok: true,
    message: `${nickname}님의 잔여 투피드권은 ${currentTwofeedCount - 1}개입니다.`,
  };
}

export async function GET(request: Request) {
  try {
    const { sessionKey, sessionStart, nextSessionStart } = getSessionWindow();
    const { searchParams } = new URL(request.url);

    const nickname = String(searchParams.get("nickname") || "").trim();
    const userId = normalizeUserId(String(searchParams.get("userId") || "").trim());

    const { data, error } = await supabaseServer
      .from("entries")
      .select("*")
      .eq("session_key", sessionKey)
      .gte("created_at", sessionStart.toISOString())
      .lt("created_at", nextSessionStart.toISOString())
      .order("created_at", { ascending: true });

    if (error) throw error;

    const skipCount =
      data?.filter((item) => item.form_type === "skip").length ?? 0;

    let alreadyParticipated = false;

    if (userId) {
      alreadyParticipated =
        data?.some((item) => String(item.user_id || "").trim() === userId) ?? false;
    } else if (nickname) {
      alreadyParticipated =
        data?.some((item) => String(item.nickname || "").trim() === nickname) ?? false;
    }

    return NextResponse.json({
      ok: true,
      entries: data ?? [],
      skipCount,
      skipRemainingCount: Math.max(0, SKIP_LIMIT - skipCount),
      sessionKey,
      alreadyParticipated,
    });
  } catch (error: unknown) {
    console.error("GET /api/entries error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: getErrorMessage(error, "목록 조회 중 오류가 발생했습니다."),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || "complete").trim();
    const entryId = body.entryId;

    if (!entryId) {
      return NextResponse.json(
        { ok: false, message: "수정 또는 완료 처리에 필요한 값이 비어 있습니다." },
        { status: 400 }
      );
    }

    const { sessionKey, sessionStart, nextSessionStart } = getSessionWindow();

    const { data: existingEntry, error: findError } = await supabaseServer
      .from("entries")
      .select("id, user_id, form_type, link1, link2")
      .eq("id", entryId)
      .eq("session_key", sessionKey)
      .gte("created_at", sessionStart.toISOString())
      .lt("created_at", nextSessionStart.toISOString())
      .maybeSingle();

    if (findError) throw findError;

    if (!existingEntry) {
      return NextResponse.json(
        { ok: false, message: "해당 링크를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (action === "update" || action === "uncomplete" || action === "complete_admin") {
      const adminPassword = String(body.adminPassword || "").trim();

      if (adminPassword !== ADMIN_PASSWORD) {
        return NextResponse.json(
          { ok: false, message: "운영진 비밀번호가 올바르지 않습니다." },
          { status: 403 }
        );
      }

      if (action === "uncomplete") {
        const { error: updateError } = await supabaseServer
          .from("entries")
          .update({
            completed_at: null,
          })
          .eq("id", entryId)
          .eq("session_key", sessionKey);

        if (updateError) throw updateError;

        return NextResponse.json({
          ok: true,
          message: "운영진이 완료 상태를 해제했습니다.",
        });
      }

      if (action === "complete_admin") {
        const { error: updateError } = await supabaseServer
          .from("entries")
          .update({
            completed_at: new Date().toISOString(),
          })
          .eq("id", entryId)
          .eq("session_key", sessionKey);

        if (updateError) throw updateError;

        return NextResponse.json({
          ok: true,
          message: "운영진이 완료 상태를 체크했습니다.",
        });
      }

      const nextLink1 = String(body.link1 || "").trim();
      const nextLink2 = String(body.link2 || "").trim();
      const formType = String(existingEntry.form_type || "").trim();

      const requiresLink1 =
        formType === "feed" ||
        formType === "skip" ||
        formType === "twofeed" ||
        formType === "sub-feed" ||
        formType === "staff";
      const requiresLink2 = formType === "twofeed";

      if (requiresLink1 && !nextLink1) {
        return NextResponse.json(
          { ok: false, message: "첫 번째 링크는 비워둘 수 없습니다." },
          { status: 400 }
        );
      }

      if (requiresLink2 && !nextLink2) {
        return NextResponse.json(
          { ok: false, message: "두 번째 링크는 비워둘 수 없습니다." },
          { status: 400 }
        );
      }

      if (nextLink1 && !isValidUrl(nextLink1)) {
        return NextResponse.json(
          { ok: false, message: "첫 번째 링크 형식이 올바르지 않습니다." },
          { status: 400 }
        );
      }

      if (nextLink2 && !isValidUrl(nextLink2)) {
        return NextResponse.json(
          { ok: false, message: "두 번째 링크 형식이 올바르지 않습니다." },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabaseServer
        .from("entries")
        .update({
          link1: nextLink1 || null,
          link2: nextLink2 || null,
        })
        .eq("id", entryId)
        .eq("session_key", sessionKey);

      if (updateError) throw updateError;

      return NextResponse.json({
        ok: true,
        message: "운영진 링크 수정이 완료되었습니다.",
      });
    }

    if (!isCompletionWindowOpen()) {
      return NextResponse.json(
        {
          ok: false,
          message: "완료 처리는 오후 10시부터 다음날 오후 2시 30분 전까지 가능합니다.",
        },
        { status: 400 }
      );
    }

    const userId = normalizeUserId(String(body.userId || "").trim());

    if (!userId) {
      return NextResponse.json(
        { ok: false, message: "완료 처리에 필요한 값이 비어 있습니다." },
        { status: 400 }
      );
    }

    if (String(existingEntry.user_id || "").trim() !== userId) {
      return NextResponse.json(
        { ok: false, message: "본인이 작성한 링크만 완료 처리할 수 있습니다." },
        { status: 403 }
      );
    }

    if (!existingEntry.link1 && !existingEntry.link2) {
      return NextResponse.json(
        { ok: false, message: "링크가 있는 신청만 완료 처리할 수 있습니다." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseServer
      .from("entries")
      .update({
        completed_at: new Date().toISOString(),
      })
      .eq("id", entryId)
      .eq("session_key", sessionKey)
      .eq("user_id", userId);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      message: "완료 처리되었습니다.",
    });
  } catch (error: unknown) {
    console.error("PATCH /api/entries error:", error);

    const message = getErrorMessage(error, "완료 처리 중 오류가 발생했습니다.");
    const missingCompletedColumn = message.includes("completed_at");

    return NextResponse.json(
      {
        ok: false,
        message: missingCompletedColumn
          ? "완료 저장이 안 되고 있습니다. Supabase entries 테이블에 completed_at 컬럼이 실제로 추가됐는지 다시 확인해 주세요."
          : !hasSupabaseServiceRoleKey &&
            (message.toLowerCase().includes("row-level security") ||
              message.toLowerCase().includes("permission denied") ||
              message.toLowerCase().includes("violates row-level security"))
          ? "현재 서버에 SUPABASE_SERVICE_ROLE_KEY가 없어 DB 정책에 막히고 있습니다. .env.local에 service role key를 추가해야 합니다."
          : message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!isFormOpen()) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "현재는 참여 가능 시간이 아닙니다. 오후 2시 30분부터 오후 10시까지만 참여할 수 있습니다.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const nickname = normalizeNickname(String(body.nickname || "").trim());
    const userId = normalizeUserId(String(body.userId || "").trim());
    const formType = String(body.formType || "").trim();
    const link1 = String(body.link1 || "").trim();
    const link2 = String(body.link2 || "").trim();

    const isReels1 = Boolean(body.isReels1);
    const isReels2 = Boolean(body.isReels2);
    const isPublic1 = Boolean(body.isPublic1);
    const isPublic2 = Boolean(body.isPublic2);

    if (!nickname || !userId || !formType) {
      return NextResponse.json(
        { ok: false, message: "필수 값이 비어 있습니다." },
        { status: 400 }
      );
    }

    const { sessionKey, sessionStart, nextSessionStart } = getSessionWindow();

    const { data: existingEntries, error: countError } = await supabaseServer
      .from("entries")
      .select("id, form_type, user_id, created_at")
      .eq("session_key", sessionKey);

    const filteredExistingEntries = (existingEntries ?? []).filter((item) => {
      const createdAt = new Date(String((item as { created_at?: string }).created_at || ""));
      return createdAt >= sessionStart && createdAt < nextSessionStart;
    });

    if (countError) throw countError;

    const alreadyParticipated =
      filteredExistingEntries.some((item) => String(item.user_id || "").trim() === userId);

    if (alreadyParticipated) {
      return NextResponse.json(
        {
          ok: false,
          message: "오늘은 이미 참여완료 했어요.",
          alreadyParticipated: true,
        },
        { status: 400 }
      );
    }

    const currentSkipCount =
      filteredExistingEntries.filter((item) => item.form_type === "skip").length ?? 0;

    const entryPayload = buildEntryPayload({
      sessionKey,
      nickname,
      userId,
      formType,
      link1,
      link2,
      isReels1,
      isReels2,
      isPublic1,
      isPublic2,
    });

    if (formType === "skip") {
      if (currentSkipCount >= SKIP_LIMIT) {
        return NextResponse.json(
          { ok: false, message: "스킵 신청이 모두 마감되었습니다." },
          { status: 400 }
        );
      }

      const skipPermission = await getSkipPermission(nickname, userId);

      if (!skipPermission.ok) {
        return NextResponse.json(
          { ok: false, message: skipPermission.message },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseServer
        .from("entries")
        .insert(entryPayload)
        .select()
        .single();

      if (error) throw error;

      await insertWeeklyUsage(userId, "skip");

      const nextSkipCount = currentSkipCount + 1;

      return NextResponse.json({
        ok: true,
        entry: data,
        skipCount: nextSkipCount,
        skipRemainingCount: Math.max(0, SKIP_LIMIT - nextSkipCount),
        message: skipPermission.message,
        alreadyParticipated: true,
      });
    }

    if (formType === "twofeed") {
      const twofeedPermission = await getTwofeedPermission(nickname, userId);

      if (!twofeedPermission.ok) {
        return NextResponse.json(
          { ok: false, message: twofeedPermission.message },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseServer
        .from("entries")
        .insert(entryPayload)
        .select()
        .single();

      if (error) throw error;

      await insertWeeklyUsage(userId, "twofeed");

      return NextResponse.json({
        ok: true,
        entry: data,
        skipCount: currentSkipCount,
        skipRemainingCount: Math.max(0, SKIP_LIMIT - currentSkipCount),
        message: twofeedPermission.message,
        alreadyParticipated: true,
      });
    }

    const { data, error } = await supabaseServer
      .from("entries")
      .insert(entryPayload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      entry: data,
      skipCount: currentSkipCount,
      skipRemainingCount: Math.max(0, SKIP_LIMIT - currentSkipCount),
      message: "정상적으로 접수되었습니다.",
      alreadyParticipated: true,
    });
  } catch (error: unknown) {
    console.error("POST /api/entries error:", error);

    const message = getErrorMessage(error, "접수 저장 중 오류가 발생했습니다.");
    const missingPublicColumn =
      message.includes("is_public1") || message.includes("is_public2");

    return NextResponse.json(
      {
        ok: false,
        message: missingPublicColumn
          ? "공게 기능을 쓰려면 entries 테이블에 is_public1, is_public2 컬럼을 먼저 추가해야 합니다."
          : !hasSupabaseServiceRoleKey &&
            (message.toLowerCase().includes("row-level security") ||
              message.toLowerCase().includes("permission denied") ||
              message.toLowerCase().includes("violates row-level security"))
          ? "현재 서버에 SUPABASE_SERVICE_ROLE_KEY가 없어 DB 정책에 막히고 있습니다. .env.local에 service role key를 추가해야 합니다."
          : message,
      },
      { status: 500 }
    );
  }
}
