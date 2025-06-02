// screens/LibraryScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, Image, TouchableOpacity, FlatList,
    ScrollView, ActivityIndicator, Platform, StatusBar,
    Modal, TextInput, Alert, StyleSheet, Button
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';

import {
    getLikedTracksIds,
    getUserPlaylists,
    createPlaylist
} from '../utils/storage';
import AddToPlaylistModal from '../components/AddToPlaylistModal';

// Импорт данных треков из JSON файла
import tracksFromJsonFile from '../assets/tracks.json';
// Используем импортированные данные как основной источник всех треков
// и экспортируем его, если он нужен в других модулях (например, PlaylistDetailScreen)
export const allTracksData = tracksFromJsonFile;

// Константы
const ICON_COLOR_PRIMARY = '#FAFAFA';
const ICON_COLOR_SECONDARY = '#A0A0A0';
const ICON_COLOR_ACCENT = '#8DEEED';
const TEXT_COLOR_ON_ACCENT = '#030318';
const BG_COLOR_SCREEN = '#030318';
const DEFAULT_PLAYLIST_ARTWORK = 'https://images.unsplash.com/photo-1587329304169-f7cdf09ac800?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8cGxheWxpc3QlMjBhcnR3b3JrfGVufDB8fDB8fHww&auto=format&fit=crop&w=100&q=60';
const DEFAULT_TRACK_ARTWORK = 'https://via.placeholder.com/50?text=🎶';

// --- Компонент FilterChip ---
const FilterChip = ({ label, selected, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        className={`py-2 px-4 rounded-full mr-2.5 border-2 
                    ${selected ? 'bg-custom-primary border-custom-primary shadow-md'
            : 'bg-custom-surface border-custom-border'}`}
        activeOpacity={0.7}
    >
        <Text className={`text-sm font-semibold 
                         ${selected ? 'text-custom-tertiary'
            : 'text-custom-quaternary/80'}`}>
            {label}
        </Text>
    </TouchableOpacity>
);

// --- Компонент ListItem ---
const ListItem = ({ item, onPress, itemType, onMoreOptionsPress }) => {
    let title = item.title || item.name || "Unknown";
    let subtitle = "Details unavailable";
    let artwork = item.artwork;
    const showMoreOptionsButton = !!onMoreOptionsPress;

    switch (itemType) {
        case 'album':
            subtitle = item.artist || `${item.tracks?.length || 0} songs`;
            artwork = item.artwork || DEFAULT_TRACK_ARTWORK;
            break;
        case 'artist':
            subtitle = `Artist • ${item.trackCount || item.tracks?.length || 0} songs`;
            artwork = item.artwork || DEFAULT_TRACK_ARTWORK;
            break;
        case 'playlist':
            subtitle = `${item.trackIds?.length || item.trackCount || 0} songs`;
            artwork = item.artwork || DEFAULT_PLAYLIST_ARTWORK;
            break;
        case 'track':
            subtitle = item.artist || "Unknown Artist";
            if (item.isLocal) { // Specific subtitle for local files
                subtitle = item.album && item.album !== "Unknown Album" && item.album !== "On this device" ? item.album : "On this device";
                if (item.artist && item.artist !== "Unknown Artist") {
                    subtitle = `${item.artist} • ${subtitle}`;
                }
            } else if (item.album && item.album !== "—" && item.artist !== item.album) {
                subtitle += ` • ${item.album}`;
            }
            artwork = item.artwork || DEFAULT_TRACK_ARTWORK;
            break;
        default:
            showMoreOptionsButton = false;
            break;
    }

    return (
        <TouchableOpacity onPress={onPress} className="flex-row items-center py-2.5 px-5 active:bg-custom-surface/50" activeOpacity={0.8}>
            <Image source={{ uri: artwork }} className="w-12 h-12 rounded-md mr-4 bg-zinc-700" />
            <View className="flex-1 justify-center">
                <Text className="text-base font-semibold text-custom-quaternary mb-0.5" numberOfLines={1}>{title}</Text>
                <Text className="text-xs text-custom-quaternary/70" numberOfLines={1}>{subtitle}</Text>
            </View>
            {showMoreOptionsButton && (
                <TouchableOpacity onPress={() => onMoreOptionsPress(item, itemType)} className="p-2 ml-2.5" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialCommunityIcons name="dots-horizontal" size={24} color={ICON_COLOR_SECONDARY} />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};

// Helper function to fetch and format all local audio files
const getFormattedLocalAudioFiles = async (currentPermission) => {
    if (currentPermission !== 'granted') return [];
    try {
        const media = await MediaLibrary.getAssetsAsync({
            mediaType: MediaLibrary.MediaType.audio,
            sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
            first: 1000, // Попробуйте с большим лимитом
        });
        const formattedTracks = media.assets.map(asset => ({
            id: `local-${asset.id}`, // Unique ID for local tracks
            title: asset.filename.replace(/\.[^/.]+$/, "") || 'Unknown Title',
            artist: asset.artist || 'Unknown Artist',
            album: asset.album || 'On this device', // Default album for local files
            artwork: null, // Local files might not have readily available artwork
            duration: Math.round(asset.duration),
            url: asset.uri,
            isLocal: true,
            type: 'track',
        }));
        return formattedTracks;
    } catch (error) {
        console.error("Error fetching local audio files:", error);
        Alert.alert("Error", "Could not fetch local audio files.");
        return [];
    }
};


export default function LibraryScreen() {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    const [selectedFilter, setSelectedFilter] = useState('All Songs');
    // Removed 'Local Files' from filters
    const filters = ['All Songs', 'Playlists', 'Albums', 'Liked Songs', 'Artists', 'Downloaded'];

    const [staticAllTracks, setStaticAllTracks] = useState([]);
    const [userPlaylists, setUserPlaylists] = useState([]);
    // Removed localTracks state: const [localTracks, setLocalTracks] = useState([]);
    const [mediaLibraryPermission, setMediaLibraryPermission] = useState(null);

    const [displayedItems, setDisplayedItems] = useState([]);
    const [itemTypeForList, setItemTypeForList] = useState('track');

    const [isLoadingStaticTracks, setIsLoadingStaticTracks] = useState(true);
    const [isProcessingData, setIsProcessingData] = useState(false);

    const [isCreatePlaylistModalVisible, setIsCreatePlaylistModalVisible] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [isAddToPlaylistModalVisible, setIsAddToPlaylistModalVisible] = useState(false);
    const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState(null);

    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web') {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                setMediaLibraryPermission(status);
                if (status !== 'granted') {
                    // Alert moved to empty state or specific user action
                    // Alert.alert('Permission Required', 'Media library access is needed for local songs.');
                }
            } else {
                setMediaLibraryPermission('granted'); // Assume granted for web if not using local files
            }
        })();
    }, []);

    useEffect(() => {
        setIsLoadingStaticTracks(true);
        setStaticAllTracks(allTracksData);
        setIsLoadingStaticTracks(false);
    }, []);

    // fetchLocalAudioFiles useCallback is removed as its logic is now in getFormattedLocalAudioFiles and used directly

    useEffect(() => {
        const loadAndFilterData = async () => {
            if (!isFocused) return;
            // Adjusted condition: removed 'Local Files'
            if (isLoadingStaticTracks && !['Playlists'].includes(selectedFilter)) {
                setIsProcessingData(true); return;
            }
            setIsProcessingData(true);
            let newItems = [];
            let newType = 'track';
            try {
                switch (selectedFilter) {
                    case 'Playlists':
                        newType = 'playlist';
                        const playlistsFromDb = await getUserPlaylists();
                        newItems = playlistsFromDb.map(p => ({ ...p, type: 'playlist', artwork: p.artwork || DEFAULT_PLAYLIST_ARTWORK, trackCount: p.trackIds?.length || 0 })).sort((a, b) => b.createdAt - a.createdAt);
                        setUserPlaylists(newItems);
                        break;
                    // 'Local Files' case removed
                    case 'All Songs':
                        newType = 'track';
                        let combinedSongs = staticAllTracks.map(t => ({ ...t, type: 'track' }));
                        if (mediaLibraryPermission === 'granted' && Platform.OS !== 'web') {
                            const localAudio = await getFormattedLocalAudioFiles(mediaLibraryPermission);
                            // Combine and ensure local tracks are identifiable
                            combinedSongs = [...combinedSongs, ...localAudio];
                        }
                        newItems = combinedSongs;
                        break;
                    case 'Liked Songs':
                        newType = 'track';
                        const lIds = await getLikedTracksIds();
                        // Liked songs should check from combined static and potentially local if we decide to allow liking local files
                        // For now, sticking to staticAllTracks for liked songs
                        newItems = staticAllTracks.filter(t => t.id && lIds.includes(t.id.toString())).map(t => ({ ...t, type: 'track' }));
                        break;
                    case 'Albums':
                        newType = 'album'; const alb = {}; staticAllTracks.forEach(t => { if (!t.album || t.album === "—") return; if (!alb[t.album]) alb[t.album] = { id: t.album, name: t.album, artwork: t.artwork, artist: t.artist, tracks: [] }; alb[t.album].tracks.push(t); }); newItems = Object.values(alb).map(a => ({ ...a, type: 'album' })); break;
                    case 'Artists':
                        newType = 'artist'; const art = {}; staticAllTracks.forEach(t => { if (!t.artist) return; if (!art[t.artist]) art[t.artist] = { id: t.artist, name: t.artist, artwork: t.artwork, trackCount: 0, tracks: [] }; art[t.artist].trackCount++; art[t.artist].tracks.push(t); }); newItems = Object.values(art).map(a => ({ ...a, type: 'artist' })); break;
                    case 'Downloaded': newType = 'track'; newItems = staticAllTracks.slice(0, 3).map(t => ({ ...t, type: 'track', downloadStatus: 'downloaded' })); break; // Mock
                    default: newItems = []; break;
                }
            } catch (error) { console.error(`Error processing ${selectedFilter}:`, error); newItems = []; }
            setDisplayedItems(newItems); setItemTypeForList(newType); setIsProcessingData(false);
        };
        loadAndFilterData();
    }, [selectedFilter, isFocused, staticAllTracks, isLoadingStaticTracks, mediaLibraryPermission]); // Removed fetchLocalAudioFiles from dependencies

    const triggerDataReloadForPlaylists = useCallback(async (switchToPlaylists = false) => {
        if (!isProcessingData) {
            setIsProcessingData(true);
            const playlistsFromDb = await getUserPlaylists();
            const formatted = playlistsFromDb.map(p => ({ ...p, type: 'playlist', artwork: p.artwork || DEFAULT_PLAYLIST_ARTWORK, trackCount: p.trackIds?.length || 0 })).sort((a,b) => b.createdAt - a.createdAt);
            setUserPlaylists(formatted);
            if (selectedFilter === 'Playlists' || switchToPlaylists) {
                setDisplayedItems(formatted);
                setItemTypeForList('playlist');
                if (switchToPlaylists && selectedFilter !== 'Playlists') setSelectedFilter('Playlists');
            }
            setIsProcessingData(false);
        }
    }, [isProcessingData, selectedFilter]);

    const handleCreatePlaylistSubmit = async () => {
        if (newPlaylistName.trim() === '') { Alert.alert("Invalid Name", "Playlist name required."); return; }
        setIsProcessingData(true);
        const created = await createPlaylist(newPlaylistName);
        setNewPlaylistName(''); setIsCreatePlaylistModalVisible(false);
        if (created) await triggerDataReloadForPlaylists(true);
        else Alert.alert("Failed", "Could not create playlist.");
        setIsProcessingData(false);
    };

    const handleTrackAddedToPlaylist = async (playlist, track) => {
        Alert.alert("Success!", `"${track.title}" was added to "${playlist.name}".`);
        await triggerDataReloadForPlaylists();
    };

    const handleItemPress = useCallback((item) => {
        let playlistForPlayer = []; let trackIndex = -1;
        let trackToPlay = item;

        if (itemTypeForList === 'track') {
            // Ensure displayedItems for 'All Songs' includes local tracks when passed to player
            playlistForPlayer = displayedItems.filter(i => i.type === 'track' && i.url);
            trackIndex = playlistForPlayer.findIndex(t => t.id === item.id);
        } else if (['album', 'artist'].includes(itemTypeForList)) {
            playlistForPlayer = (item.tracks || []).filter(t => t && t.url);
            if (playlistForPlayer.length > 0) { trackToPlay = playlistForPlayer[0]; trackIndex = 0; }
            else { trackToPlay = null; }
        } else if (itemTypeForList === 'playlist') {
            // For playlists, resolve track IDs against all known tracks (static + potentially local if playlists could store local IDs)
            // Current implementation resolves against staticAllTracks. If local tracks can be added to playlists, this needs adjustment.
            // For now, assuming playlist tracks are from staticAllTracks.
            const hydratedTracks = item.trackIds?.map(id => {
                const foundTrack = staticAllTracks.find(t => t.id === id);
                // If playlists could contain local tracks, you'd need a way to find them too.
                // e.g. by checking displayedItems if 'All Songs' is the source, or a combined list.
                return foundTrack;
            }).filter(t => !!t && t.url);

            playlistForPlayer = hydratedTracks || [];
            if (playlistForPlayer.length > 0) { trackToPlay = playlistForPlayer[0]; trackIndex = 0; }
            else { trackToPlay = null; }
        }

        if (trackToPlay && trackToPlay.url) {
            if (trackIndex === -1 && playlistForPlayer.length > 0 && playlistForPlayer[0].id === trackToPlay.id) trackIndex = 0;
            else if (trackIndex === -1) { playlistForPlayer = [trackToPlay]; trackIndex = 0; }
            navigation.navigate('Player', { track: trackToPlay, playlist: playlistForPlayer, currentIndex: trackIndex });
        } else if (itemTypeForList !== 'track' && !trackToPlay) {
            if (itemTypeForList === 'album') navigation.navigate('AlbumDetail', { albumId: item.id, albumName: item.name, tracks: item.tracks, artwork: item.artwork });
            else if (itemTypeForList === 'artist') navigation.navigate('ArtistDetail', { artistId: item.id, artistName: item.name, tracks: item.tracks, artwork: item.artwork });
            else if (itemTypeForList === 'playlist') navigation.navigate('PlaylistDetail', { playlistId: item.id, playlistName: item.name, tracks: [], artwork: item.artwork || DEFAULT_PLAYLIST_ARTWORK });
        } else { Alert.alert("Cannot Play", "This item cannot be played or has no playable tracks."); }
    }, [navigation, itemTypeForList, displayedItems, staticAllTracks]);

    const handleMoreOptionsPress = (item, type) => {
        if (type === 'track') { setTrackToAddToPlaylist(item); setIsAddToPlaylistModalVisible(true); }
        else { Alert.alert("More Options", `Options for ${item.name || item.title} (${type}) not implemented.`); }
    };

    const openCreatePlaylistModal = () => { setNewPlaylistName(''); setIsCreatePlaylistModalVisible(true); };
    const renderListItem = ({ item }) => (<ListItem item={item} onPress={() => handleItemPress(item)} itemType={itemTypeForList} onMoreOptionsPress={handleMoreOptionsPress} />);

    const ListHeaderContent = () => (
        <>
            <View className={`flex-row justify-between items-center px-5 pb-2 pt-4 ${Platform.OS === 'android' ? 'android:pt-10' : 'ios:pt-5'}`}>
                <Text className="text-3xl font-bold text-custom-quaternary">Library</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Search')} className="p-2 rounded-full active:bg-custom-surface/50"><Ionicons name="search" size={26} color={ICON_COLOR_PRIMARY} /></TouchableOpacity>
            </View>
            <View className="pb-1.5">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollContentContainer}>
                    {filters.map((filterName) => (<FilterChip key={filterName} label={filterName} selected={selectedFilter === filterName} onPress={() => setSelectedFilter(filterName)} />))}
                </ScrollView>
            </View>
            {selectedFilter === 'Playlists' && (
                <TouchableOpacity className="flex-row items-center py-3 px-5 mx-5 mb-3 bg-custom-surface rounded-lg active:bg-custom-surface/80 shadow-sm" onPress={openCreatePlaylistModal} activeOpacity={0.8}>
                    <Ionicons name="add-circle-outline" size={24} color={ICON_COLOR_PRIMARY} className="mr-3" />
                    <Text className="text-custom-quaternary text-base font-medium">Create New Playlist</Text>
                </TouchableOpacity>
            )}
            {/* Removed 'Refresh Local Files' button */}
            {displayedItems.length > 0 && !['track', 'playlist'].includes(itemTypeForList) && (
                <View className="px-5 pb-2 pt-1"><Text className="text-xl font-bold text-custom-quaternary">{selectedFilter}</Text></View>
            )}
        </>
    );

    if (isLoadingStaticTracks && selectedFilter !== 'Playlists') { // Adjusted condition
        return (<View style={styles.fullScreenLoader}><ActivityIndicator size="large" color={ICON_COLOR_ACCENT} /></View>);
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
            <FlatList
                data={displayedItems}
                renderItem={renderListItem}
                keyExtractor={(item, index) => `${itemTypeForList}-${item.isLocal ? 'local':''}-${item.id?.toString() || index.toString()}`}
                ListHeaderComponent={ListHeaderContent}
                ListEmptyComponent={() => (
                    !isProcessingData && (
                        <View style={styles.emptyStateContainer}>
                            <MaterialCommunityIcons name="music-box-multiple-outline" size={56} color={ICON_COLOR_SECONDARY} />
                            <Text style={styles.emptyStateText}>
                                {selectedFilter === 'All Songs' && Platform.OS !== 'web' && mediaLibraryPermission !== 'granted' && mediaLibraryPermission !== null
                                    ? "Grant permission to access local audio files."
                                    : `No ${selectedFilter.toLowerCase()} found.`
                                }
                            </Text>
                            {selectedFilter === 'Playlists' && displayedItems.length === 0 && ( <Text style={styles.emptyStateSubText}>Tap "Create New Playlist" to start.</Text> )}
                            {selectedFilter === 'All Songs' && Platform.OS !== 'web' && mediaLibraryPermission !== 'granted' && mediaLibraryPermission !== null && (
                                <TouchableOpacity onPress={async () => {
                                    const { status } = await MediaLibrary.requestPermissionsAsync();
                                    setMediaLibraryPermission(status);
                                    if (status === 'granted') {
                                        // Optionally trigger a manual refresh if useEffect doesn't catch it fast enough
                                        // For now, relying on useEffect for mediaLibraryPermission change
                                    }
                                }} className="mt-4 bg-custom-primary py-2 px-4 rounded-md">
                                    <Text className="text-custom-tertiary font-semibold">Request Permission</Text>
                                </TouchableOpacity>
                            )}
                            {selectedFilter === 'All Songs' && Platform.OS !== 'web' && mediaLibraryPermission === 'granted' && displayedItems.length === staticAllTracks.length && staticAllTracks.length > 0 && (
                                <Text style={styles.emptyStateSubText}>No additional local audio files found on your device. Add audio files to your device's music folders.</Text>
                            )}
                            {selectedFilter === 'All Songs' && Platform.OS !== 'web' && mediaLibraryPermission === 'granted' && displayedItems.length === 0 && ( // Only static tracks are 0
                                <Text style={styles.emptyStateSubText}>No songs found in your library or on your device. Add audio files to your device's music folders.</Text>
                            )}
                        </View>
                    )
                )}
                contentContainerStyle={{ paddingBottom: 90 }}
                showsVerticalScrollIndicator={false}
                extraData={isProcessingData || selectedFilter || mediaLibraryPermission || displayedItems.length}
            />
            {isProcessingData && !isLoadingStaticTracks && ( <View style={styles.processingOverlay}><ActivityIndicator size="large" color={ICON_COLOR_ACCENT} /></View> )}
            <Modal animationType="fade" transparent={true} visible={isCreatePlaylistModalVisible} onRequestClose={() => { setIsCreatePlaylistModalVisible(false); setNewPlaylistName(''); }}>
                <View style={styles.modalOuterContainer}><View style={styles.modalInnerContainer}>
                    <Text className="text-xl font-bold text-custom-quaternary mb-6 text-center">New Playlist</Text>
                    <TextInput placeholder="Enter playlist name" placeholderTextColor={ICON_COLOR_SECONDARY} value={newPlaylistName} onChangeText={setNewPlaylistName} className="bg-custom-tertiary text-custom-quaternary p-4 rounded-lg mb-6 border border-custom-border text-base" autoFocus={true} onSubmitEditing={handleCreatePlaylistSubmit} />
                    <View className="flex-row justify-end space-x-3">
                        <TouchableOpacity onPress={() => { setIsCreatePlaylistModalVisible(false); setNewPlaylistName(''); }} className="py-3 px-5 rounded-lg bg-zinc-600 active:bg-zinc-500"><Text className="text-custom-quaternary font-semibold">Cancel</Text></TouchableOpacity>
                        <TouchableOpacity onPress={handleCreatePlaylistSubmit} className="py-3 px-5 rounded-lg bg-custom-primary active:opacity-80"><Text className="font-semibold" style={{ color: TEXT_COLOR_ON_ACCENT }}>Create</Text></TouchableOpacity>
                    </View>
                </View></View>
            </Modal>
            {trackToAddToPlaylist && (<AddToPlaylistModal visible={isAddToPlaylistModalVisible} onClose={() => { setIsAddToPlaylistModalVisible(false); setTrackToAddToPlaylist(null); }} trackToAdd={trackToAddToPlaylist} onTrackAdded={handleTrackAddedToPlaylist} onCreateNewPlaylist={openCreatePlaylistModal}/>)}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG_COLOR_SCREEN },
    fullScreenLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG_COLOR_SCREEN },
    chipsScrollContentContainer: { paddingHorizontal: 20, paddingVertical: 10 },
    processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: 20 },
    emptyStateText: { fontSize: 17, fontWeight: '600', color: ICON_COLOR_SECONDARY, textAlign: 'center', marginTop: 16 },
    emptyStateSubText: { fontSize: 14, color: ICON_COLOR_SECONDARY, opacity: 0.8, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
    modalOuterContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20 },
    modalInnerContainer: { backgroundColor: '#1E1E1E', width: '100%', padding: 24, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2}, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5},
});
