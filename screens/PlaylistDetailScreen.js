// screens/PlaylistDetailScreen.js
import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, StatusBar, Image, FlatList, Alert, StyleSheet, ActivityIndicator  } from 'react-native';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native'; // Добавляем useIsFocused
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import TrackListItem from '../components/TrackListItem';
import { removeTrackFromPlaylist, getUserPlaylists,   updatePlaylistDetails,
    deletePlaylist  } from '../utils/storage';
import { usePlayer } from '../context/PlayerContext';
import { allTracksData as globalAllTracks } from './LibraryScreen'; // Предполагаем, что allTracksData экспортируется из LibraryScreen или другого общего места

const ICON_COLOR_PRIMARY = '#FAFAFA';
const ICON_COLOR_ACCENT = '#8DEEED';
const TEXT_ON_ACCENT_BUTTON_COLOR = '#030318';
const BG_COLOR_SCREEN = '#030318';
const ICON_COLOR_SECONDARY = '#A0A0A0';
const DEFAULT_PLAYLIST_ARTWORK_DETAIL = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=60';

const PlaylistDetailScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const isFocused = useIsFocused(); // Для обновления списка при возврате на экран
    const { actions: playerActions } = usePlayer();

    const params = route.params || {};
    const playlistIdParam = params.playlistId; // Получаем ID из параметров

    const [playlistDetails, setPlaylistDetails] = useState(null);
    const [tracks, setTracks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Состояния для модалки "Добавить в плейлист" (если нужна на этом экране)
    // const [isAddToPlaylistModalVisible, setIsAddToPlaylistModalVisible] = useState(false);
    // const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState(null);
    const playlistIdFromRoute = route.params?.playlistId;


    const fetchPlaylistData = useCallback(async () => {
        // Используем playlistIdFromRoute, который должен быть стабильным для этого экрана
        if (!playlistIdFromRoute) {
            console.warn("[PlaylistDetail] No playlistId provided to fetch details.");
            // Если ID нет, возможно, это новый, еще не сохраненный плейлист - используем initial-данные из route.params
            // Это маловероятный сценарий, если мы всегда переходим с ID
            setPlaylistDetails({
                id: 'new-' + Date.now(),
                name: route.params?.playlistName || "New Playlist",
                artwork: route.params?.artwork || DEFAULT_PLAYLIST_ARTWORK_DETAIL,
                description: route.params?.description || "",
                trackIds: route.params?.tracks?.map(t => t.id) || []
            });
            setTracks(route.params?.tracks || []);
            setIsLoading(false);
            return;
        }

        console.log(`[PlaylistDetail] Fetching data for playlist ID: ${playlistIdFromRoute}`);
        setIsLoading(true);
        try {
            const allPlaylists = await getUserPlaylists();
            const currentPlaylistData = allPlaylists.find(p => p.id === playlistIdFromRoute);

            if (currentPlaylistData) {
                const hydratedTracks = currentPlaylistData.trackIds
                    ?.map(trackId => globalAllTracks.find(t => t.id === trackId))
                    .filter(track => !!track);
                setTracks(hydratedTracks || []);
                setPlaylistDetails({
                    id: currentPlaylistData.id,
                    name: currentPlaylistData.name,
                    artwork: currentPlaylistData.artwork || DEFAULT_PLAYLIST_ARTWORK_DETAIL,
                    description: currentPlaylistData.description,
                    trackIds: currentPlaylistData.trackIds || []
                });
            } else {
                console.warn(`[PlaylistDetail] Playlist with ID ${playlistIdFromRoute} not found in storage.`);
                setPlaylistDetails(null); // Явно указываем, что плейлист не найден
                setTracks([]);
                // Alert.alert("Error", "Playlist not found.", [{ text: "OK", onPress: () => navigation.goBack() }]);
            }
        } catch (error) {
            console.error("[PlaylistDetail] Error fetching playlist data:", error);
            setPlaylistDetails(null);
            setTracks([]);
        } finally {
            setIsLoading(false);
        }
    }, [playlistIdFromRoute, navigation]); // Убрал route.params.* из зависимостей, оставил только стабильный playlistIdFromRoute

    useEffect(() => {
        if (isFocused && playlistIdFromRoute) { // Добавил проверку на playlistIdFromRoute
            console.log("[PlaylistDetail] Screen focused, calling fetchPlaylistData.");
            fetchPlaylistData();
        } else if (isFocused && !playlistIdFromRoute && route.params?.tracks) {
            // Если нет ID, но есть треки в параметрах (например, новый плейлист перед сохранением)
            // Этот блок может быть не нужен, если мы всегда передаем ID
            setPlaylistDetails({ name: route.params.playlistName, artwork: route.params.artwork, description: route.params.description, trackIds: route.params.tracks.map(t=>t.id) });
            setTracks(route.params.tracks);
            setIsLoading(false);
        }
    }, [isFocused, playlistIdFromRoute, fetchPlaylistData, route.params?.tracks]); // Добавил route.params.tracks для случая без ID


    const handlePlayTrack = useCallback((selectedTrack, index) => { /* ... как в AlbumDetailScreen ... */ }, [navigation, tracks, playerActions]);
    const handlePlayAllPlaylist = useCallback(() => { /* ... */ }, [tracks, handlePlayTrack]);
    const handleShufflePlaylist = useCallback(() => { /* ... */ }, [tracks, navigation]);

    const handleRemoveTrackFromThisPlaylist = async (trackToRemove) => {
        if (!playlistDetails || !playlistDetails.id) return;
        Alert.alert(
            "Remove Track",
            `Remove "${trackToRemove.title}" from "${playlistDetails.name}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove", style: "destructive",
                    onPress: async () => {
                        const success = await removeTrackFromPlaylist(playlistDetails.id, trackToRemove.id);
                        if (success) {
                            // Обновляем локальное состояние треков
                            setTracks(prevTracks => prevTracks.filter(t => t.id !== trackToRemove.id));
                            // Опционально обновить детали плейлиста, если trackIds там используются для счетчика
                            setPlaylistDetails(prev => ({...prev, trackIds: prev.trackIds.filter(id => id !== trackToRemove.id)}));
                            Alert.alert("Track Removed");
                        } else { Alert.alert("Error", "Could not remove track."); }
                    }
                }
            ]
        );
    };

    // const handleOpenAddToOtherPlaylistModal = (track) => { /* ... если нужно добавлять в *другой* плейлист ... */ };

    const renderTrackItem = ({ item, index }) => (
        <TrackListItem
            item={item}
            index={index}
            onPress={() => handlePlayTrack(item, index)}
            // Вместо onMoreOptionsPress передаем onRemovePress
            onMoreOptionsPress={() => handleRemoveTrackFromThisPlaylist(item)} // Или можно сделать сложное меню
            showArtwork={true} // Показываем арт трека в плейлисте
        />
    );

    const ListHeader = () => {
        if (!playlistDetails) return <ActivityIndicator size="large" color={ICON_COLOR_ACCENT} className="mt-10"/>;
        return (
            <View className="items-center mb-4">
                <Image source={{ uri: playlistDetails.artwork }} className="w-48 h-48 md:w-56 md:h-56 rounded-xl shadow-lg my-5 bg-zinc-700" />
                <Text className="text-2xl md:text-3xl font-bold text-custom-quaternary text-center px-4" numberOfLines={2}>{playlistDetails.name}</Text>
                {playlistDetails.description && (<Text className="text-sm text-custom-quaternary/70 mt-1 mb-2 text-center px-6" numberOfLines={3}>{playlistDetails.description}</Text>)}
                <Text className="text-sm text-custom-quaternary/70 mb-5">{tracks.length} {tracks.length === 1 ? "song" : "songs"}</Text>
                {tracks && tracks.length > 0 && (
                    <View className="flex-row w-full px-1 space-x-3 mb-6">
                        {/* ... Кнопки Play и Shuffle ... */}
                    </View>
                )}
            </View>
        );
    };

    if (isLoading) {
        return <View className="flex-1 justify-center items-center bg-custom-tertiary"><ActivityIndicator size="large" color={ICON_COLOR_ACCENT} /></View>;
    }
    if (!playlistDetails && !isLoading) { // Если после загрузки плейлиста нет
        return <View className="flex-1 justify-center items-center bg-custom-tertiary"><Text className="text-custom-quaternary">Playlist not found.</Text></View>;
    }


    return (
        <View style={{ flex: 1, backgroundColor: BG_COLOR_SCREEN }}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
            <View style={[styles.headerContainer, {backgroundColor: BG_COLOR_SCREEN}]}>
                {/* ... Заголовок с кнопкой назад и именем плейлиста ... */}
                {/* ... Кнопка "Больше опций" для плейлиста (редактировать, удалить плейлист) ... */}
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 rounded-full active:bg-custom-surface/50">
                    <Ionicons name="arrow-back" size={26} color={ICON_COLOR_PRIMARY} />
                </TouchableOpacity>
                <Text className="flex-1 text-lg font-semibold text-custom-quaternary text-center mx-2" numberOfLines={1}>{playlistDetails?.name}</Text>
                <TouchableOpacity className="p-2 rounded-full active:bg-custom-surface/50" onPress={() => Alert.alert("Playlist Options", "Edit, Delete this playlist etc.")}>
                    <MaterialCommunityIcons name="dots-horizontal" size={26} color={ICON_COLOR_PRIMARY} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={tracks}
                renderItem={renderTrackItem}
                keyExtractor={(item, index) => item.id?.toString() || `playlisttrack-${index}`}
                ListHeaderComponent={ListHeader}
                ListEmptyComponent={()=>(
                    <View className="flex-1 justify-center items-center px-5 mt-10">
                        <MaterialCommunityIcons name="playlist-music-outline" size={56} color={ICON_COLOR_SECONDARY} />
                        <Text className="text-lg font-semibold text-custom-quaternary/70 mt-4 text-center">This playlist is empty.</Text>
                        <Text className="text-sm text-custom-quaternary/50 mt-2 text-center">Add some songs!</Text>
                    </View>
                )}
                contentContainerStyle={styles.flatListContent}
                showsVerticalScrollIndicator={false}
            />
            {/* Если нужна модалка для добавления в *другой* плейлист отсюда
            {trackToAddToPlaylist && (
                 <AddToPlaylistModal ... />
            )}
            */}
        </View>
    );
};

// styles аналогичны AlbumDetailScreen
const styles = StyleSheet.create({
    headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 48, paddingBottom: 12, zIndex: 10 },
    flatListContent: { paddingHorizontal: 16, paddingBottom: 90 },
});

export default PlaylistDetailScreen;
