import { google } from "googleapis";

type MemberRow = {
  twofeedRaw: string;
  skipRaw: string;
  identityRaw: string;
};

function getSheetsClient() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error("구글 시트 환경변수가 비어 있습니다.");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  return {
    sheets,
    spreadsheetId,
  };
}

export async function getMemberRows(): Promise<string[][]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const range = process.env.GOOGLE_SHEETS_MEMBER_RANGE || "좋댓별!C2:C";

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return result.data.values || [];
}

export async function getMemberRowsWithItems(): Promise<MemberRow[]> {
  const { sheets, spreadsheetId } = getSheetsClient();

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "좋댓별!A2:C",
  });

  const rows = result.data.values || [];

  return rows.map((row) => ({
    twofeedRaw: String(row[0] || "").trim(),
    skipRaw: String(row[1] || "").trim(),
    identityRaw: String(row[2] || "").trim(),
  }));
}

export function normalizeNickname(value: string) {
  return value.trim();
}

export function normalizeUserId(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function parseIdentityCell(cellValue: string) {
  const lines = cellValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  return {
    nickname: normalizeNickname(lines[0]),
    userId: normalizeUserId(lines[1]),
  };
}

export function extractItemCount(raw: string) {
  if (!raw) return 0;

  const match = raw.match(/\d+/);
  if (!match) return 0;

  return Number(match[0]);
}