import React from "react";
import { Image, View } from "react-native";
import { AvatarConfig } from "../constants/avatar-parts";

const AVATAR_IMAGES: Record<string, any> = {
  "1_1": require("../../assets/avatars/avatar_1_1.png"),
  "1_2": require("../../assets/avatars/avatar_1_2.png"),
  "1_3": require("../../assets/avatars/avatar_1_3.png"),
  "1_4": require("../../assets/avatars/avatar_1_4.png"),
  "1_5": require("../../assets/avatars/avatar_1_5.png"),
  "1_6": require("../../assets/avatars/avatar_1_6.png"),
  "2_1": require("../../assets/avatars/avatar_2_1.png"),
  "2_2": require("../../assets/avatars/avatar_2_2.png"),
  "2_3": require("../../assets/avatars/avatar_2_3.png"),
  "2_4": require("../../assets/avatars/avatar_2_4.png"),
  "2_5": require("../../assets/avatars/avatar_2_5.png"),
  "2_6": require("../../assets/avatars/avatar_2_6.png"),
  "3_1": require("../../assets/avatars/avatar_3_1.png"),
  "3_2": require("../../assets/avatars/avatar_3_2.png"),
  "3_3": require("../../assets/avatars/avatar_3_3.png"),
  "3_4": require("../../assets/avatars/avatar_3_4.png"),
  "3_5": require("../../assets/avatars/avatar_3_5.png"),
  "3_6": require("../../assets/avatars/avatar_3_6.png"),
  "4_1": require("../../assets/avatars/avatar_4_1.png"),
  "4_2": require("../../assets/avatars/avatar_4_2.png"),
  "4_3": require("../../assets/avatars/avatar_4_3.png"),
  "4_4": require("../../assets/avatars/avatar_4_4.png"),
  "4_5": require("../../assets/avatars/avatar_4_5.png"),
  "4_6": require("../../assets/avatars/avatar_4_6.png"),
};

const RING_COLOR: Record<string, string> = {
  "1_1": "#4da0ca", "1_2": "#ac8555", "1_3": "#bec4ca", "1_4": "#e6bf91", "1_5": "#8b5cf6", "1_6": "#ebb14b",
  "2_1": "#206f9d", "2_2": "#dca948", "2_3": "#6f8548", "2_4": "#e0d5c3", "2_5": "#f38408", "2_6": "#e2c7ac",
  "3_1": "#cb9845", "3_2": "#577d8e", "3_3": "#b48949", "3_4": "#30907a", "3_5": "#aea38e", "3_6": "#807a56",
  "4_1": "#19938f", "4_2": "#6f479b", "4_3": "#618e2d", "4_4": "#f1d599", "4_5": "#937869", "4_6": "#c7aa6f",
};

const AVATAR_ZOOM: Record<string, number> = {
  "1_1": 1.261, "1_2": 1.271, "1_3": 1.261, "1_4": 1.261, "1_5": 1.293, "1_6": 1.23,
  "2_1": 1.339, "2_2": 1.316, "2_3": 1.351, "2_4": 1.282, "2_5": 1.364, "2_6": 1.364,
  "3_1": 1.327, "3_2": 1.339, "3_3": 1.351, "3_4": 1.364, "3_5": 1.389, "3_6": 1.429,
  "4_1": 1.23, "4_2": 1.23, "4_3": 1.25, "4_4": 1.22, "4_5": 1.21, "4_6": 1.282,
};

interface Props { config: AvatarConfig; size?: number; }

export default function AvatarCharacter({ config, size = 120 }: Props) {
  const source = AVATAR_IMAGES[config.avatarId] ?? AVATAR_IMAGES["1_1"];
  const ring = RING_COLOR[config.avatarId] ?? "#4f7cff";
  const zoom = AVATAR_ZOOM[config.avatarId] ?? 1.20;
  const border = 3;
  const inner = size - border * 2;
  const imgSize = Math.round(inner * zoom);
  const offset = -Math.round((imgSize - inner) / 2);
  return (
    <View style={{ width: size, height: size, borderRadius: size/2, borderWidth: border, borderColor: ring }}>
      <View style={{ width: inner, height: inner, borderRadius: inner/2, overflow: "hidden" }}>
        <Image source={source} style={{ width: imgSize, height: imgSize, marginLeft: offset, marginTop: offset }} resizeMode="cover" />
      </View>
    </View>
  );
}
