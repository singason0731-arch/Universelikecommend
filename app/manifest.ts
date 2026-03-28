import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "유니버스 좋댓별",
    short_name: "유니버스 좋댓별",
    description: "유니버스 좋댓별 링크 접수 및 취합 페이지",
    start_url: "/",
    display: "standalone",
    background_color: "#0c131c",
    theme_color: "#16212d",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
