import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 30%, #223446 0%, #16212d 46%, #0c131c 100%)",
          color: "#f5e8c8",
          fontSize: 82,
          fontWeight: 900,
          borderRadius: 40,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 24,
            fontSize: 30,
            transform: "rotate(12deg)",
          }}
        >
          ✦
        </div>
        <div
          style={{
            width: 98,
            height: 98,
            borderRadius: 30,
            background: "rgba(245, 232, 200, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 8px rgba(245, 232, 200, 0.06)",
          }}
        >
          ★
        </div>
      </div>
    ),
    size
  );
}
