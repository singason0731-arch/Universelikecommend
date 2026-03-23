import { NextResponse } from "next/server";
import {
  getMemberRows,
  normalizeNickname,
  normalizeUserId,
  parseIdentityCell,
} from "@/lib/googleSheets";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const nickname = normalizeNickname(String(body.nickname || ""));
    const userId = normalizeUserId(String(body.userId || ""));

    if (!nickname || !userId) {
      return NextResponse.json(
        {
          ok: false,
          message: "닉네임과 아이디를 모두 입력해야 합니다.",
        },
        { status: 400 }
      );
    }

    const rows = await getMemberRows();

    const matched = rows.some((row) => {
      const cellValue = String(row[0] || "").trim();
      if (!cellValue) return false;

      const parsed = parseIdentityCell(cellValue);
      if (!parsed) return false;

      return parsed.nickname === nickname && parsed.userId === userId;
    });

    if (!matched) {
      return NextResponse.json({
        ok: false,
        message: "닉네임과 아이디가 시트에서 동일한 회원 정보로 확인되지 않습니다.",
      });
    }

    return NextResponse.json({
      ok: true,
      message: "회원 확인이 완료되었습니다.",
    });
  } catch (error: any) {
    console.error("POST /api/member-check error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: error?.message || "회원 확인 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}