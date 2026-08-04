import React from "react";
import Svg, { Circle, Rect, Path, Ellipse, Text as SvgText, G } from "react-native-svg";
import {
  AvatarConfig, SKIN_TONES, HAIR_COLORS, HAT_OPTIONS, JERSEY_COLORS,
} from "../constants/avatar-parts";

function getSkin(id: string) { return SKIN_TONES.find(s => s.id === id)?.color ?? "#FDDBB4"; }
function getHair(id: string) { return HAIR_COLORS.find(h => h.id === id)?.color ?? "#6B3A2A"; }
function getJersey(id: string) { return JERSEY_COLORS.find(j => j.id === id)?.color ?? "#1e40af"; }
function getHat(id: string) { return HAT_OPTIONS.find(h => h.id === id) ?? HAT_OPTIONS[0]; }
function dk(hex: string, amt = 0.2) {
  if (hex === "none") return "none";
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor(((n >> 16) & 0xff) * (1 - amt)));
  const g = Math.max(0, Math.floor(((n >> 8) & 0xff) * (1 - amt)));
  const b = Math.max(0, Math.floor((n & 0xff) * (1 - amt)));
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

interface Props { config: AvatarConfig; size?: number; }

export default function AvatarCharacter({ config, size = 120 }: Props) {
  const skin = getSkin(config.skinTone);
  const hair = getHair(config.hairColor);
  const jersey = getJersey(config.jersey);
  const hat = getHat(config.hat);
  const hasHat = config.hat !== "none";

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {/* Shirt */}
      <Path
        d="M 0,200 L 0,168 C 30,148 66,138 86,136 L 86,152 Q 100,157 114,152 L 114,136 C 134,138 170,148 200,168 L 200,200 Z"
        fill={jersey}
      />
      {/* Jersey collar accent */}
      <Path d="M 86,136 Q 100,148 114,136 Q 112,126 100,126 Q 88,126 86,136 Z" fill={dk(jersey, 0.15)} />
      {/* Neck */}
      <Rect x="88" y="124" width="24" height="18" fill={skin} rx="3" />
      {/* Left ear */}
      <Ellipse cx="45" cy="94" rx="10" ry="13" fill={skin} />
      <Ellipse cx="45" cy="94" rx="6" ry="8" fill={dk(skin, 0.12)} />
      {/* Head */}
      <Circle cx="100" cy="88" r="55" fill={skin} />
      {/* Right ear */}
      <Ellipse cx="155" cy="94" rx="10" ry="13" fill={skin} />
      <Ellipse cx="155" cy="94" rx="6" ry="8" fill={dk(skin, 0.12)} />
      {/* Hair */}
      {config.hairStyle !== "bald" && !hasHat && <FullHair style={config.hairStyle} color={hair} />}
      {config.hairStyle !== "bald" && hasHat && <SideHair style={config.hairStyle} color={hair} />}
      {/* Hat */}
      {hasHat && <HatLayer hat={hat} />}
      {/* Face */}
      <FaceFeatures expr={config.expression} skin={skin} />
    </Svg>
  );
}

function FullHair({ style, color }: { style: string; color: string }) {
  const d = dk(color, 0.2);
  switch (style) {
    case "short": return (
      <Path d="M 46,84 C 46,34 100,28 100,28 C 100,28 154,34 154,84 C 140,54 100,54 100,54 C 100,54 60,54 46,84 Z" fill={color} />
    );
    case "medium": return (
      <Path d="M 44,86 C 44,34 100,26 100,26 C 100,26 156,34 156,86 L 157,120 C 144,132 122,138 100,138 C 78,138 56,132 43,120 Z" fill={color} />
    );
    case "long": return (
      <Path d="M 42,84 C 42,32 100,24 100,24 C 100,24 158,32 158,84 L 162,166 C 140,176 120,180 100,180 C 80,180 60,176 38,166 Z" fill={color} />
    );
    case "curly": return (
      <G>
        <Path d="M 46,80 C 42,60 44,44 54,34 C 60,22 72,16 100,16 C 128,16 140,22 146,34 C 156,44 158,60 154,80 C 140,52 100,48 100,48 C 100,48 60,52 46,80 Z" fill={color} />
        <Circle cx="68" cy="28" r="16" fill={color} />
        <Circle cx="100" cy="18" r="18" fill={color} />
        <Circle cx="132" cy="28" r="16" fill={color} />
      </G>
    );
    case "bun": return (
      <G>
        <Path d="M 50,84 C 50,44 100,36 100,36 C 100,36 150,44 150,84 C 138,60 100,60 100,60 C 100,60 62,60 50,84 Z" fill={color} />
        <Rect x="95" y="22" width="10" height="18" fill={color} rx="4" />
        <Circle cx="100" cy="14" r="16" fill={color} />
        <Ellipse cx="100" cy="31" rx="8" ry="4" fill={d} />
      </G>
    );
    case "mohawk": return (
      <G>
        <Rect x="93" y="12" width="14" height="58" rx="7" fill={color} />
        <Ellipse cx="100" cy="12" rx="10" ry="8" fill={color} />
      </G>
    );
    case "low": return (
      <Path d="M 52,86 C 52,46 100,40 100,40 C 100,40 148,46 148,86 C 138,66 100,66 100,66 C 100,66 62,66 52,86 Z" fill={color} />
    );
    default: return null;
  }
}

function SideHair({ style, color }: { style: string; color: string }) {
  if (style === "long") return (
    <Path d="M 44,92 L 40,166 C 60,176 80,180 100,180 C 120,180 140,176 160,166 L 156,92 C 140,102 120,108 100,108 C 80,108 60,102 44,92 Z" fill={color} />
  );
  if (style === "curly") return (
    <G>
      <Circle cx="50" cy="100" r="18" fill={color} />
      <Circle cx="150" cy="100" r="18" fill={color} />
    </G>
  );
  if (style === "bun") return (
    <G>
      <Rect x="95" y="22" width="10" height="18" fill={color} rx="4" />
      <Circle cx="100" cy="14" r="16" fill={color} />
    </G>
  );
  return null;
}

function HatLayer({ hat }: { hat: ReturnType<typeof getHat> }) {
  const { primary, secondary, text, abbrev } = hat;
  const brim = dk(primary, 0.18);
  const fs = abbrev.length >= 5 ? 10 : abbrev.length >= 4 ? 12 : abbrev.length >= 3 ? 14 : 17;
  return (
    <G>
      {/* Cap dome */}
      <Path d="M 44,80 C 44,26 100,18 100,18 C 100,18 156,26 156,80 Q 128,64 100,64 Q 72,64 44,80 Z" fill={primary} />
      {/* Brim */}
      <Path d="M 50,78 Q 100,90 150,78 Q 154,78 154,90 Q 128,100 100,100 Q 72,100 46,90 Q 46,78 50,78 Z" fill={brim} />
      {/* Brim shadow */}
      <Path d="M 54,84 Q 100,93 146,84 Q 146,89 100,91 Q 54,89 54,84 Z" fill={dk(primary, 0.35)} opacity="0.4" />
      {/* Cap button */}
      <Circle cx="100" cy="19" r="5" fill={secondary} opacity="0.9" />
      {/* Team text */}
      {abbrev.length > 0 && (
        <SvgText x="100" y="55" textAnchor="middle" fill={text} fontSize={fs} fontWeight="bold" letterSpacing="0.5">
          {abbrev}
        </SvgText>
      )}
    </G>
  );
}

function FaceFeatures({ expr, skin }: { expr: string; skin: string }) {
  const isHappy = expr === "happy";
  const isVHappy = expr === "very_happy";
  const isCool = expr === "cool";
  const isFierce = expr === "fierce";
  const isSmug = expr === "smug";

  const browL = isFierce ? "M 70,72 Q 82,77 90,72" : isSmug ? "M 70,70 Q 82,65 90,70" : "M 70,74 Q 82,68 90,74";
  const browR = isFierce ? "M 110,72 Q 118,77 130,72" : "M 110,74 Q 118,68 130,74";
  const eyeRy = isCool ? 3 : 6;

  const mouth = isVHappy
    ? undefined
    : isHappy ? "M 82,112 Q 100,126 118,112"
    : isCool ? "M 88,114 Q 100,120 112,110"
    : isFierce ? "M 84,116 Q 100,110 116,116"
    : isSmug ? "M 86,114 Q 98,120 114,110"
    : "M 86,114 L 114,114";

  return (
    <G>
      {/* Eyebrows */}
      <Path d={browL} stroke="#2d1a0e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <Path d={browR} stroke="#2d1a0e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Eyes */}
      <Ellipse cx="82" cy="88" rx="7" ry={eyeRy} fill="#1a1008" />
      <Ellipse cx="118" cy="88" rx="7" ry={eyeRy} fill="#1a1008" />
      <Circle cx="85" cy="85" r="2.5" fill="white" />
      <Circle cx="121" cy="85" r="2.5" fill="white" />
      {/* Nose */}
      <Path d="M 97,100 Q 94,107 100,108 Q 106,107 103,100" stroke={dk(skin, 0.18)} strokeWidth="1.5" fill="none" opacity="0.7" />
      {/* Mouth */}
      {isVHappy ? (
        <G>
          <Path d="M 80,110 Q 100,128 120,110 Q 100,120 80,110 Z" fill="#1a1008" />
          <Rect x="84" y="113" width="32" height="8" rx="2" fill="white" />
        </G>
      ) : (
        <Path d={mouth} stroke="#2d1a0e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {/* Blush */}
      {(isHappy || isVHappy) && (
        <G>
          <Ellipse cx="66" cy="102" rx="11" ry="6" fill="#f9a8d4" opacity="0.45" />
          <Ellipse cx="134" cy="102" rx="11" ry="6" fill="#f9a8d4" opacity="0.45" />
        </G>
      )}
    </G>
  );
}
