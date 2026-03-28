import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
          position: "relative",
          color: "#f5e8c8",
          fontSize: 220,
          fontWeight: 900,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 34,
            borderRadius: 112,
            border: "12px solid rgba(245, 232, 200, 0.16)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 76,
            right: 86,
            fontSize: 86,
            transform: "rotate(12deg)",
          }}
        >
          ✦
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 84,
            left: 82,
            fontSize: 50,
            opacity: 0.7,
          }}
        >
          ✦
        </div>
        <div
          style={{
            width: 272,
            height: 272,
            borderRadius: 88,
            background: "rgba(245, 232, 200, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 16px rgba(245, 232, 200, 0.06)",
          }}
        >
          유
        </div>
      </div>
    ),
    size
  );
}
