// screens/ArtistDetailScreen.js
import React, { useCallback } from 'react';
import {
    View, Text, TouchableOpacity, Platform,
    StatusBar, Image, FlatList
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const ICON_COLOR_PRIMARY = '#FAFAFA';
const ICON_COLOR_ACCENT = '#8DEEED';
const TEXT_ON_ACCENT_BUTTON_COLOR = '#030318';
const ICON_COLOR_SECONDARY = '#A0A0A0';

const ArtistDetailScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();

    const params = route.params || {};
    const {
        artistName = "Artist",
        tracks = [],
        artwork
    } = params;

    const handlePlayTrack = useCallback((selectedTrack, index) => {
        if (!selectedTrack || !selectedTrack.url) return;
        navigation.navigate('Player', {
            track: selectedTrack,
            playlist: tracks.filter(t => t && t.url),
            currentIndex: index,
        });
    }, [navigation, tracks]);

    const handlePlayAllArtistTracks = useCallback(() => {
        const playableTracks = tracks.filter(t => t && t.url);
        if (playableTracks.length > 0) {
            handlePlayTrack(playableTracks[0], tracks.findIndex(t => t.id === playableTracks[0].id));
        }
    }, [tracks, handlePlayTrack]);

    const handleShuffleArtistTracks = useCallback(() => {
        const playableTracks = tracks.filter(t => t && t.url);
        if (playableTracks.length > 0) {
            const shuffledPlaylist = [...playableTracks].sort(() => Math.random() - 0.5);
            navigation.navigate('Player', {
                track: shuffledPlaylist[0],
                playlist: shuffledPlaylist,
                currentIndex: 0,
            });
        }
    }, [tracks, navigation]);

    const renderTrackItem = ({ item, index }) => (
        <TouchableOpacity
            onPress={() => handlePlayTrack(item, index)}
            className="flex-row items-center p-3 mb-1.5 bg-custom-surface/10 rounded-lg active:bg-custom-surface/20"
        >
            {item.artwork && (
                <Image source={{uri: item.artwork}} className="w-10 h-10 rounded mr-3 bg-zinc-700" />
            )}
            {!item.artwork && (
                <Text className="text-sm text-custom-quaternary/70 w-8 text-center tabular-nums">
                    {index + 1}
                </Text>
            )}
            <View className="flex-1 ml-1">
                <Text className="text-base font-medium text-custom-quaternary" numberOfLines={1}>
                    {item.title || "Unknown Track"}
                </Text>
                {item.album && (
                    <Text className="text-xs text-custom-quaternary/60" numberOfLines={1}>
                        {item.album}
                    </Text>
                )}
            </View>
            <TouchableOpacity className="p-2" onPress={() => console.log("More options for track:", item.title)}>
                <MaterialCommunityIcons name="dots-horizontal" size={22} color={ICON_COLOR_SECONDARY} />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    const ListHeader = () => (
        <View className="items-center mb-4">
            {artwork && (
                <Image
                    source={{ uri: artwork }}
                    // Круглый арт для артиста
                    className="w-40 h-40 md:w-48 md:h-48 rounded-full shadow-lg my-5 bg-zinc-700"
                />
            )}
            <Text className="text-2xl md:text-3xl font-bold text-custom-quaternary text-center px-4" numberOfLines={2}>
                {artistName}
            </Text>
            <Text className="text-sm text-custom-quaternary/70 mt-1 mb-5">
                {tracks.length} {tracks.length === 1 ? "song" : "songs"}
            </Text>

            {tracks && tracks.length > 0 && (
                <View className="flex-row w-full px-4 space-x-3 mb-6">
                    <TouchableOpacity
                        onPress={handlePlayAllArtistTracks}
                        className="flex-1 bg-custom-primary py-3.5 rounded-full flex-row items-center justify-center active:opacity-80 shadow-md"
                    >
                        <Ionicons name="play" size={20} color={TEXT_ON_ACCENT_BUTTON_COLOR} className="mr-1.5" />
                        <Text className="font-semibold text-base" style={{ color: TEXT_ON_ACCENT_BUTTON_COLOR }}>
                            Play
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleShuffleArtistTracks}
                        className="flex-1 bg-custom-surface py-3.5 rounded-full flex-row items-center justify-center active:opacity-80 shadow-md border border-custom-border"
                    >
                        <Ionicons name="shuffle" size={20} color={ICON_COLOR_PRIMARY} className="mr-1.5" />
                        <Text className="text-custom-quaternary font-semibold text-base">Shuffle</Text>
                    </TouchableOpacity>
                </View>
            )}
            {tracks && tracks.length > 0 && (
                <Text className="text-lg font-semibold text-custom-quaternary self-start px-4 mb-2">
                    Popular Tracks
                </Text>
            )}
        </View>
    );

    return (
        <View className="flex-1 bg-custom-tertiary">
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
            <View className={`flex-row items-center justify-between px-3 android:pt-10 ${Platform.OS === 'ios' ? 'pt-12' : 'pt-4'} pb-3 z-10 bg-custom-tertiary`}>
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 rounded-full active:bg-custom-surface/50">
                    <Ionicons name="arrow-back" size={26} color={ICON_COLOR_PRIMARY} />
                </TouchableOpacity>
                <Text className="flex-1 text-lg font-semibold text-custom-quaternary text-center mx-2" numberOfLines={1}>
                    {artistName}
                </Text>
                <TouchableOpacity className="p-2 rounded-full active:bg-custom-surface/50">
                    <View className="w-[26px]" />
                </TouchableOpacity>
            </View>

            {tracks && tracks.length > 0 ? (
                <FlatList
                    data={tracks}
                    renderItem={renderTrackItem}
                    keyExtractor={(item, index) => item.id?.toString() || `track-${index}`}
                    ListHeaderComponent={ListHeader}
                    contentContainerStyle={{ paddingHorizontal: Platform.OS === 'web' ? 0 : 16, paddingBottom: 90 }}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <View className="flex-1 justify-center items-center px-4">
                    <ListHeader />
                    <MaterialCommunityIcons name="account-music-outline" size={48} color={ICON_COLOR_SECONDARY} />
                    <Text className="text-custom-quaternary/70 mt-4 text-lg text-center">
                        No popular tracks found for this artist.
                    </Text>
                </View>
            )}
        </View>
    );
};

export default ArtistDetailScreen;
