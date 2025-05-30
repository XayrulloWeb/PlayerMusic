// components/TrackListItem.js
import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Цвета (используйте ваши HEX или Tailwind классы)
const ICON_COLOR_SECONDARY_LIST_ITEM = '#A0A0A0'; // custom-text-secondary
const DEFAULT_TRACK_ARTWORK_LIST_ITEM = 'https://via.placeholder.com/40?text=🎶';

const TrackListItem = ({ item, index, onPress, onMoreOptionsPress, showTrackNumber = true, showArtwork = true }) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            // Tailwind классы для элемента списка
            className="flex-row items-center py-3 px-1.5 mb-1.5 bg-custom-surface/10 rounded-lg active:bg-custom-surface/20"
            // Замените custom-surface на ваш цвет (или, например, bg-zinc-800/10)
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
                    {/* На экране артиста альбом может быть важнее, на экране альбома - артист (если разный) */}
                    {item.artist || "Unknown Artist"}
                    {item.album && item.artist !== item.album ? ` • ${item.album}` : ''}
                </Text>
            </View>
            {onMoreOptionsPress && ( // Показываем кнопку только если передан обработчик
                <TouchableOpacity onPress={() => onMoreOptionsPress(item)} className="p-2 ml-1">
                    <MaterialCommunityIcons name="dots-horizontal" size={22} color={ICON_COLOR_SECONDARY_LIST_ITEM} />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};

export default TrackListItem;
