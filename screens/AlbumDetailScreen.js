// screens/AlbumDetailScreen.js
import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, StatusBar, Image, FlatList, Alert, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import TrackListItem from '../components/TrackListItem'; // Используем новый компонент
import { usePlayer } from '../context/PlayerContext';

// Цвета и константы
const ICON_COLOR_PRIMARY = '#FAFAFA'; // custom-quaternary
const ICON_COLOR_ACCENT = '#8DEEED';   // custom-primary
const TEXT_ON_ACCENT_BUTTON_COLOR = '#030318'; // custom-tertiary
const BG_COLOR_SCREEN = '#030318';     // custom-tertiary

const AlbumDetailScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { actions: playerActions } = usePlayer();

    const params = route.params || {};
    const {
        albumName = "Album",
        tracks: initialTracks = [],
        artist = "Unknown Artist",
        artwork
    } = params;

    // Состояния для модального окна "Добавить в плейлист"
    const [isAddToPlaylistModalVisible, setIsAddToPlaylistModalVisible] = useState(false);
    const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState(null);

    const handlePlayTrack = useCallback((selectedTrack, index) => {
        if (!selectedTrack || !selectedTrack.url) {
            Alert.alert("Cannot Play", "This track does not have a valid URL."); return;
        }
        // playerActions.loadAudio(selectedTrack, true, initialTracks.filter(t => t && t.url), index);
        navigation.navigate('Player', {
            track: selectedTrack,
            playlist: initialTracks.filter(t => t && t.url),
            currentIndex: index,
        });
    }, [navigation, initialTracks, playerActions]);

    const handlePlayAll = useCallback(() => {
        const playableTracks = initialTracks.filter(t => t && t.url);
        if (playableTracks.length > 0) {
            handlePlayTrack(playableTracks[0], initialTracks.findIndex(t => t.id === playableTracks[0].id));
        }
    }, [initialTracks, handlePlayTrack]);

    const handleShufflePlay = useCallback(() => {
        const playableTracks = initialTracks.filter(t => t && t.url);
        if (playableTracks.length > 0) {
            const shuffledPlaylist = [...playableTracks].sort(() => Math.random() - 0.5);
            navigation.navigate('Player', { track: shuffledPlaylist[0], playlist: shuffledPlaylist, currentIndex: 0 });
        }
    }, [initialTracks, navigation]);

    const handleOpenAddToPlaylistModal = (track) => {
        setTrackToAddToPlaylist(track);
        setIsAddToPlaylistModalVisible(true);
    };

    const handleTrackAddedToPlaylist = (playlist, track) => {
        Alert.alert("Track Added", `"${track.title}" was added to "${playlist.name}".`);
    };

    const handleRequestCreateNewPlaylistFromModal = () => {
        setIsAddToPlaylistModalVisible(false);
        navigation.navigate("Main", { screen: "LibraryTab", params: { action: "createPlaylist", prefillTrackId: trackToAddToPlaylist?.id } });
        // LibraryScreen должен будет обработать параметр action: "createPlaylist" и, возможно, prefillTrackId
    };

    const renderTrackItem = ({ item, index }) => (
        <TrackListItem
            item={item}
            index={index}
            onPress={() => handlePlayTrack(item, index)}
            onMoreOptionsPress={handleOpenAddToPlaylistModal}
            showArtwork={false} // На экране альбома обычно не показывают арт у каждого трека
        />
    );

    const ListHeader = () => (
        <View className="items-center mb-4">
            {artwork && (
                <Image source={{ uri: artwork }} className="w-48 h-48 md:w-56 md:h-56 rounded-xl shadow-lg my-5 bg-zinc-700" />
            )}
            <Text className="text-2xl md:text-3xl font-bold text-custom-quaternary text-center px-4" numberOfLines={2}>{albumName}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ArtistDetail', { artistId: artist, artistName: artist /* ... и другие данные артиста ... */ })}>
                <Text className="text-lg text-custom-primary mt-1 mb-5 hover:underline">{artist}</Text>
            </TouchableOpacity>
            {initialTracks && initialTracks.length > 0 && (
                <View className="flex-row w-full px-1 space-x-3 mb-6">
                    <TouchableOpacity onPress={handlePlayAll} className="flex-1 bg-custom-primary py-3.5 rounded-full flex-row items-center justify-center active:opacity-80 shadow-md">
                        <Ionicons name="play" size={20} color={TEXT_ON_ACCENT_BUTTON_COLOR} className="mr-1.5" />
                        <Text className="font-semibold text-base" style={{ color: TEXT_ON_ACCENT_BUTTON_COLOR }}>Play</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleShufflePlay} className="flex-1 bg-custom-surface py-3.5 rounded-full flex-row items-center justify-center active:opacity-80 shadow-md border border-custom-border">
                        <Ionicons name="shuffle" size={20} color={ICON_COLOR_PRIMARY} className="mr-1.5" />
                        <Text className="text-custom-quaternary font-semibold text-base">Shuffle</Text>
                    </TouchableOpacity>
                </View>
            )}
            {initialTracks && initialTracks.length > 0 && (
                <Text className="text-lg font-semibold text-custom-quaternary self-start mb-2">Tracks ({initialTracks.length})</Text>
            )}
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: BG_COLOR_SCREEN }}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
            <View style={[styles.headerContainer, {backgroundColor: BG_COLOR_SCREEN /* Для zIndex эффекта */}]}>
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 rounded-full active:bg-custom-surface/50">
                    <Ionicons name="arrow-back" size={26} color={ICON_COLOR_PRIMARY} />
                </TouchableOpacity>
                <Text className="flex-1 text-lg font-semibold text-custom-quaternary text-center mx-2" numberOfLines={1}>{albumName}</Text>
                <TouchableOpacity className="p-2 rounded-full active:bg-custom-surface/50">
                    {/* <MaterialCommunityIcons name="heart-outline" size={26} color={ICON_COLOR_PRIMARY} /> */}
                    <View className="w-[26px]" />
                </TouchableOpacity>
            </View>

            {initialTracks && initialTracks.length > 0 ? (
                <FlatList
                    data={initialTracks}
                    renderItem={renderTrackItem}
                    keyExtractor={(item, index) => item.id?.toString() || `albumtrack-${index}`}
                    ListHeaderComponent={ListHeader}
                    contentContainerStyle={styles.flatListContent}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <ScrollView contentContainerStyle={styles.emptyContainer}>
                    <ListHeader /> {/* Показываем инфо об альбоме даже если треков нет */}
                    <MaterialCommunityIcons name="album-outline" size={48} color={ICON_COLOR_SECONDARY} />
                    <Text className="text-custom-quaternary/70 mt-4 text-lg text-center">No tracks found in this album.</Text>
                </ScrollView>
            )}

            {trackToAddToPlaylist && (
                <AddToPlaylistModal
                    visible={isAddToPlaylistModalVisible}
                    onClose={() => { setIsAddToPlaylistModalVisible(false); setTrackToAddToPlaylist(null); }}
                    trackToAdd={trackToAddToPlaylist}
                    onTrackAdded={handleTrackAddedToPlaylist}
                    onCreateNewPlaylist={handleRequestCreateNewPlaylistFromModal}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    headerContainer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 12, // px-3
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 48, // android:pt-10 / ios:pt-12
        paddingBottom: 12, // pb-3
        zIndex: 10, // Чтобы был поверх контента FlatList
    },
    flatListContent: { paddingHorizontal: 16, paddingBottom: 90 }, // px-4, pb-24
    emptyContainer: { flexGrow:1, justifyContent: 'center', alignItems: 'center', padding: 20},
});

export default AlbumDetailScreen;
