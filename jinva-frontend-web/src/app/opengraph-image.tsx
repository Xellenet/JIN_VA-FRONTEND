import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "JinVa — Find trusted local artisans for any job"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f1a13",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Subtle gradient accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #1C4532, #2d6a4f, #1C4532)",
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: "20px",
            backgroundColor: "#1C4532",
            marginBottom: 32,
          }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 32 32"
            fill="none"
          >
            <path
              d="M12 8C12 7.44772 12.4477 7 13 7C13.5523 7 14 7.44772 14 8V18C14 20.7614 16.2386 23 19 23C19.5523 23 20 23.4477 20 24C20 24.5523 19.5523 25 19 25C15.134 25 12 21.866 12 18V8Z"
              fill="white"
            />
            <circle cx="19" cy="9" r="2" fill="white" />
          </svg>
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-3px",
            lineHeight: 1,
            marginBottom: 20,
          }}
        >
          JinVa
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "#6b9e80",
            textAlign: "center",
            maxWidth: 680,
            lineHeight: 1.4,
          }}
        >
          Find trusted local artisans for any job
        </div>
      </div>
    ),
    { ...size },
  )
}
