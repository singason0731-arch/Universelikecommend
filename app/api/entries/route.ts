import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
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

function getSessionKey() {
  const { now, dateText, currentMinutes } = getSeoulDateTime();
  const resetMinutes = 14 * 60 + 30;

  if (currentMinutes >= resetMinutes) {
    return dateText;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(yesterday);
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
  const openMinutes = 14 * 60 + 30;
  const closeMinutes = 22 * 60;

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
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

  const { data, error } = await supabase
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

  const { error } = await supabase.from("item_usages").insert({
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
    const sessionKey = getSessionKey();
    const { searchParams } = new URL(request.url);

    const nickname = String(searchParams.get("nickname") || "").trim();
    const userId = normalizeUserId(String(searchParams.get("userId") || "").trim());

    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .eq("session_key", sessionKey)
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
  } catch (error: any) {
    console.error("GET /api/entries error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "목록 조회 중 오류가 발생했습니다.",
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

    // ✅ 릴스 체크값 받기
    const isReels1 = Boolean(body.isReels1);
    const isReels2 = Boolean(body.isReels2);

    if (!nickname || !userId || !formType) {
      return NextResponse.json(
        { ok: false, message: "필수 값이 비어 있습니다." },
        { status: 400 }
      );
    }

    const sessionKey = getSessionKey();

    const { data: existingEntries, error: countError } = await supabase
      .from("entries")
      .select("id, form_type, user_id")
      .eq("session_key", sessionKey);

    if (countError) throw countError;

    const alreadyParticipated =
      existingEntries?.some((item) => String(item.user_id || "").trim() === userId) ?? false;

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
      existingEntries?.filter((item) => item.form_type === "skip").length ?? 0;

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

      const { data, error } = await supabase
        .from("entries")
        .insert({
          session_key: sessionKey,
          nickname,
          user_id: userId,
          form_type: formType,
          link1: link1 || null,
          link2: link2 || null,
          is_reels1: isReels1,
          is_reels2: isReels2,
        })
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

      const { data, error } = await supabase
        .from("entries")
        .insert({
          session_key: sessionKey,
          nickname,
          user_id: userId,
          form_type: formType,
          link1: link1 || null,
          link2: link2 || null,
          is_reels1: isReels1,
          is_reels2: isReels2,
        })
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

    const { data, error } = await supabase
      .from("entries")
      .insert({
        session_key: sessionKey,
        nickname,
        user_id: userId,
        form_type: formType,
        link1: link1 || null,
        link2: link2 || null,
        is_reels1: isReels1,
        is_reels2: isReels2,
      })
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
  } catch (error: any) {
    console.error("POST /api/entries error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "접수 저장 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}