/* eslint-disable @next/next/no-img-element */
import type { HTMLAttributes } from "react"

/**
 * An iPhone 17 Pro Max frame around a screenshot or video.
 *
 * The frame is a real transparent PNG (`public/brand/iphone-frame.png`), drawn on
 * top; the media sits underneath, in the screen's rectangle. The numbers below
 * were measured from that PNG, so they change only if the file does.
 */
const FRAME_SRC = "/brand/iphone-frame.png"
const FRAME_WIDTH = 505
const FRAME_HEIGHT = 1034

// The screen opening, grown by 1px on every side so the media runs under the
// bezel's soft inner edge and no gap can show.
const SCREEN_X = 23
const SCREEN_Y = 19
const SCREEN_WIDTH = 460
const SCREEN_HEIGHT = 996
// Tighter than the opening's own corner, so the bezel covers the media's corners,
// and wide enough that they never reach past the phone's outer edge.
const SCREEN_RADIUS = 64

const LEFT_PCT = (SCREEN_X / FRAME_WIDTH) * 100
const TOP_PCT = (SCREEN_Y / FRAME_HEIGHT) * 100
const WIDTH_PCT = (SCREEN_WIDTH / FRAME_WIDTH) * 100
const HEIGHT_PCT = (SCREEN_HEIGHT / FRAME_HEIGHT) * 100
const RADIUS_H = (SCREEN_RADIUS / SCREEN_WIDTH) * 100
const RADIUS_V = (SCREEN_RADIUS / SCREEN_HEIGHT) * 100

export interface IphoneProps extends HTMLAttributes<HTMLDivElement> {
  src?: string
  videoSrc?: string
}

export function Iphone({
  src,
  videoSrc,
  className,
  style,
  ...props
}: IphoneProps) {
  const screen = {
    left: `${LEFT_PCT}%`,
    top: `${TOP_PCT}%`,
    width: `${WIDTH_PCT}%`,
    height: `${HEIGHT_PCT}%`,
    borderRadius: `${RADIUS_H}% / ${RADIUS_V}%`,
  }

  return (
    <div
      className={`relative inline-block w-full align-middle leading-none ${className ?? ""}`}
      style={{
        aspectRatio: `${FRAME_WIDTH}/${FRAME_HEIGHT}`,
        ...style,
      }}
      {...props}
    >
      {(videoSrc || src) && (
        <div className="pointer-events-none absolute z-0 overflow-hidden bg-black" style={screen}>
          {videoSrc ? (
            <video
              className="block size-full object-cover"
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <img src={src} alt="" className="block size-full object-cover object-top" />
          )}
        </div>
      )}

      <img
        src={FRAME_SRC}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 z-10 size-full select-none"
      />
    </div>
  )
}
