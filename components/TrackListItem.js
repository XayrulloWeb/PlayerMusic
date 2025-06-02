// components/TrackListItem.js
import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ICON_COLOR_SECONDARY_LIST_ITEM = '#A0A0A0'; // или ваш custom-text-secondary
const DEFAULT_TRACK_ARTWORK_LIST_ITEM = 'https://via.placeholder.com/40?text=🎶';

const TrackListItem = ({ item, index, onPress, onMoreOptionsPress, showTrackNumber = true, showArtwork = true }) => {
    if (!item) return null;

    return (
        <TouchableOpacity
            onPress={onPress}
            className="flex-row items-center py-3 px-1.5 mb-1.5 bg-custom-surface/10 rounded-lg active:bg-custom-surface/20"
            // Замените custom-surface на ваш цвет фона для элементов (или bg-zinc-800/10)
        >
            {showTrackNumber && index !== undefined && (
                <Text className="text-sm text-custom-quaternary/70 w-8 text-center tabular-nums">
                    {/* text-custom-quaternary/70 или ваш вторичный цвет текста */}
                    {index + 1}
                </Text>
            )}
            {showArtwork && (
                <Image
                    source={{ uri: item.artwork || DEFAULT_TRACK_ARTWORK_LIST_ITEM }}
                    className={`w-10 h-10 rounded-md ${showTrackNumber ? 'ml-1 mr-3' : 'mr-3'} bg-zinc-700`}
                />
            )}
            <View className={`flex-1 ${!showArtwork && !showTrackNumber ? '' : (showArtwork && !showTrackNumber ? 'mr-3' : (showArtwork ? '' : 'ml-3'))}`}>
                <Text className="text-base font-medium text-custom-quaternary" numberOfLines={1}>
                    {/* text-custom-quaternary или ваш основной цвет текста */}
                    {item.title || "Unknown Track"}
                </Text>
                <Text className="text-xs text-custom-quaternary/60" numberOfLines={1}>
                    {/* text-custom-quaternary/60 или ваш вторичный цвет текста */}
                    {item.artist || "Unknown Artist"}
                    {item.album && item.album !== "—" && item.artist !== item.album ? ` • ${item.album}` : ''}
                </Text>
            </View>
            {onMoreOptionsPress && (
                <TouchableOpacity onPress={() => onMoreOptionsPress(item)} className="p-2 ml-1">
                    <MaterialCommunityIcons name="dots-horizontal" size={22} color={ICON_COLOR_SECONDARY_LIST_ITEM} />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};

export default TrackListItem;
