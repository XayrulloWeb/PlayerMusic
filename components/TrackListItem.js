import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

const ICON_COLOR_SECONDARY_LIST_ITEM = '#A0A0A0';
const ICON_COLOR_DANGER = '#ef4444';
const ICON_COLOR_ACCENT = '#8DEEED';
const DEFAULT_TRACK_ARTWORK_LIST_ITEM = 'https://via.placeholder.com/40?text=🎶';

const TrackListItem = ({
                           item,
                           index,
                           onPress,
                           onMoreOptionsPress,
                           onDeletePress,
                           onToggleLike,
                           onToggleDownload,
                           showTrackNumber = true,
                           showArtwork = true,
                       }) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="flex-row items-center py-3 px-1.5 mb-1.5 bg-custom-surface/10 rounded-lg active:bg-custom-surface/20"
        >
            {showTrackNumber && (
                <Text className="text-sm text-custom-quaternary/70 w-8 text-center tabular-nums">
                    {index + 1}
                </Text>
            )}
            {showArtwork && (
                <Image
                    source={{ uri: item.artwork || DEFAULT_TRACK_ARTWORK_LIST_ITEM }}
                    className={`w-10 h-10 rounded-md ${showTrackNumber ? 'ml-1 mr-3' : 'mr-3'} bg-zinc-700`}
                />
            )}
            <View className={`flex-1 ${!showArtwork && !showTrackNumber ? '' : 'ml-1'}`}>
                <Text className="text-base font-medium text-custom-quaternary" numberOfLines={1}>
                    {item.title || "Unknown Track"}
                </Text>
                <Text className="text-xs text-custom-quaternary/60" numberOfLines={1}>
                    {item.isLocal && item.artist === "Unknown Artist" && item.album === "On this device" ? "Local Audio File" :
                        item.artist || "Unknown Artist"}
                    {item.album && item.album !== "—" && item.album !== "On this device" && item.artist !== item.album ? ` • ${item.album}` : ''}
                </Text>
            </View>
            <View className="flex-row items-center">
                {onToggleLike && (
                    <TouchableOpacity onPress={() => onToggleLike(item)} className="p-2">
                        <Ionicons
                            name={item.isLiked ? "heart" : "heart-outline"}
                            size={22}
                            color={item.isLiked ? ICON_COLOR_DANGER : ICON_COLOR_SECONDARY_LIST_ITEM}
                        />
                    </TouchableOpacity>
                )}
                {onToggleDownload && (
                    <TouchableOpacity onPress={() => onToggleDownload(item)} className="p-2">
                        <Ionicons
                            name={item.downloadStatus === 'downloaded' ? "cloud-download" : "cloud-download-outline"}
                            size={22}
                            color={item.downloadStatus === 'downloaded' ? ICON_COLOR_ACCENT : ICON_COLOR_SECONDARY_LIST_ITEM}
                        />
                    </TouchableOpacity>
                )}
                {onDeletePress && (
                    <TouchableOpacity onPress={() => onDeletePress(item)} className="p-2">
                        <Ionicons name="remove-circle-outline" size={22} color={ICON_COLOR_DANGER} />
                    </TouchableOpacity>
                )}
                {onMoreOptionsPress && !onDeletePress && (
                    <TouchableOpacity onPress={() => onMoreOptionsPress(item, 'track')} className="p-2">
                        <MaterialCommunityIcons name="dots-horizontal" size={22} color={ICON_COLOR_SECONDARY_LIST_ITEM} />
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
};

export default TrackListItem;
