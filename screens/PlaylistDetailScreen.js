// screens/PlaylistDetailScreen.js
import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, Image, FlatList, Alert, StyleSheet, Modal, TextInput, ActivityIndicator, StatusBar as RNStatusBar } from 'react-native'; // Added RNStatusBar here, was missing from provided snippet but used in styles.absoluteCloseButton
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import TrackListItem from '../components/TrackListItem';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
// import TrackOptionsMenuModal from '../components/TrackOptionsMenuModal'; // REMOVED
import {
    removeTrackFromPlaylist as storageRemoveTrackFromPlaylist,
    getUserPlaylists,
    updatePlaylistDetails,
    deletePlaylist,
    isTrackLiked as checkIsTrackLiked,
    likeTrack as storageLikeTrack,
    unlikeTrack as storageUnlikeTrack
} from '../utils/storage';
import { usePlayer } from '../context/PlayerContext';
import { allTracksData as globalAllTracks } from './LibraryScreen';

const ICON_COLOR_PRIMARY = '#FAFAFA';
const ICON_COLOR_ACCENT = '#8DEEED';
const TEXT_COLOR_ON_ACCENT = '#030318';
const BG_COLOR_SCREEN = '#030318';
const ICON_COLOR_SECONDARY = '#A0A0A0';
const DEFAULT_PLAYLIST_ARTWORK_DETAIL = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=60';
const MENU_BORDER_COLOR = '#374151'; // Для встроенного меню

const PlaylistDetailScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const insets = useSafeAreaInsets();
    const { currentTrack: currentPlayerTrack, isLiked: isCurrentTrackLikedByContext, actions: playerActions } = usePlayer();

    const playlistIdParam = route.params?.playlistId;

    const [playlistDetails, setPlaylistDetails] = useState(null);
    const [tracks, setTracks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessingAction, setIsProcessingAction] = useState(false);

    const [isEditPlaylistModalVisible, setIsEditPlaylistModalVisible] = useState(false);
    const [editingPlaylistName, setEditingPlaylistName] = useState('');
    const [editingPlaylistDescription, setEditingPlaylistDescription] = useState('');

    const [isTrackOptionsMenuVisible, setIsTrackOptionsMenuVisible] = useState(false);
    const [selectedTrackForTrackOptions, setSelectedTrackForTrackOptions] = useState(null);
    const [selectedTrackIsLikedLocal, setSelectedTrackIsLikedLocal] = useState(false);
    const [isAddToOtherPlaylistModalVisible, setIsAddToOtherPlaylistModalVisible] = useState(false);

    const fetchPlaylistData = useCallback(async (showLoadingSpinner = true) => {
        if (!playlistIdParam) {
            Alert.alert("Error", "Playlist ID not provided.", [{ text: "OK", onPress: () => navigation.goBack() }]);
            if(showLoadingSpinner) setIsLoading(false); return;
        }
        if (showLoadingSpinner) setIsLoading(true);
        try {
            const allPlaylists = await getUserPlaylists();
            const currentPlaylistData = allPlaylists.find(p => p.id === playlistIdParam);
            if (currentPlaylistData) {
                const hydratedTracks = currentPlaylistData.trackIds?.map(id => globalAllTracks.find(t => t.id === id)).filter(t => !!t) || [];
                setTracks(hydratedTracks);
                setPlaylistDetails(currentPlaylistData);
                // Set default artwork if not present
                if (!currentPlaylistData.artwork) {
                    currentPlaylistData.artwork = DEFAULT_PLAYLIST_ARTWORK_DETAIL;
                }
            } else { Alert.alert("Error", "Playlist not found.", [{ text: "OK", onPress: () => navigation.goBack() }]); setPlaylistDetails(null); }
        } catch (error) { console.error("[PlaylistDetail] Error fetching playlist:", error); Alert.alert("Error", "Could not load details.", [{ text: "OK", onPress: () => navigation.goBack() }]);}
        if (showLoadingSpinner) setIsLoading(false);
    }, [playlistIdParam, navigation]);

    useEffect(() => { if (isFocused) fetchPlaylistData(); }, [isFocused, fetchPlaylistData]);

    useEffect(() => {
        const checkIfSelectedTrackIsLiked = async () => {
            if (selectedTrackForTrackOptions?.id) {
                if (currentPlayerTrack?.id === selectedTrackForTrackOptions.id) {
                    setSelectedTrackIsLikedLocal(isCurrentTrackLikedByContext);
                } else {
                    setSelectedTrackIsLikedLocal(await checkIsTrackLiked(selectedTrackForTrackOptions.id));
                }
            }
        };
        if (isTrackOptionsMenuVisible && selectedTrackForTrackOptions) {
            checkIfSelectedTrackIsLiked();
        }
    }, [isTrackOptionsMenuVisible, selectedTrackForTrackOptions, currentPlayerTrack, isCurrentTrackLikedByContext]);

    const handlePlayTrack = useCallback((selectedTrack, index) => {
        if (!selectedTrack || !selectedTrack.url) { Alert.alert("Cannot Play", "Track has no URL."); return; }
        navigation.navigate('Player', { track: selectedTrack, playlist: tracks.filter(t => t && t.url), currentIndex: index });
    }, [navigation, tracks]);

    const handlePlayAllPlaylist = useCallback(() => {
        const playableTracks = tracks.filter(t => t && t.url);
        if (playableTracks.length > 0) {
            const firstPlayableIndex = tracks.findIndex(t => t.id === playableTracks[0].id);
            handlePlayTrack(playableTracks[0], firstPlayableIndex >= 0 ? firstPlayableIndex : 0);
        }
    }, [tracks, handlePlayTrack]);

    const handleShufflePlaylist = useCallback(() => {
        const playableTracks = tracks.filter(t => t && t.url);
        if (playableTracks.length > 0) {
            const shuffled = [...playableTracks].sort(() => 0.5 - Math.random());
            navigation.navigate('Player', { track: shuffled[0], playlist: shuffled, currentIndex: 0 });
        }
    }, [tracks, navigation]);

    const handleRemoveTrackFromThisPlaylistConfirmation = async () => { // Renamed to avoid conflict and make it clear this is the final action
        if (!playlistDetails?.id || !selectedTrackForTrackOptions?.id) return;
        setIsProcessingAction(true);
        const success = await storageRemoveTrackFromPlaylist(playlistDetails.id, selectedTrackForTrackOptions.id);
        if (success) {
            const updatedTracks = tracks.filter(t => t.id !== selectedTrackForTrackOptions.id);
            setTracks(updatedTracks);
            setPlaylistDetails(prev => ({...prev, trackIds: prev.trackIds.filter(id => id !== selectedTrackForTrackOptions.id)}));
            Alert.alert("Track Removed");
        } else { Alert.alert("Error", "Could not remove track."); }
        setIsProcessingAction(false);
        closeTrackOptionsMenu();
    };

    const handleMenuActionRemoveFromThisPlaylist = () => { // This will be called by the menu item
        if (!selectedTrackForTrackOptions) return;
        Alert.alert("Remove Track", `Remove "${selectedTrackForTrackOptions.title}" from "${playlistDetails.name}"?`, [
            { text: "Cancel", style: "cancel", onPress: closeTrackOptionsMenu }, // Close menu if cancelled from alert
            { text: "Remove", style: "destructive", onPress: handleRemoveTrackFromThisPlaylistConfirmation }
        ]);
        // Don't closeTrackOptionsMenu here, it's handled by the Alert's buttons or by handleRemoveTrackFromThisPlaylistConfirmation
    };


    const openEditPlaylistModal = () => {
        if (!playlistDetails) return;
        setEditingPlaylistName(playlistDetails.name);
        setEditingPlaylistDescription(playlistDetails.description || '');
        setIsEditPlaylistModalVisible(true);
    };

    const handleSavePlaylistDetails = async () => {
        if (!playlistDetails || !editingPlaylistName.trim()) { Alert.alert("Invalid Name", "Playlist name cannot be empty."); return; }
        setIsProcessingAction(true);
        const updated = await updatePlaylistDetails(playlistDetails.id, { name: editingPlaylistName, description: editingPlaylistDescription });
        setIsEditPlaylistModalVisible(false);
        if (updated) {
            setPlaylistDetails(prev => ({...prev, ...updated})); // Ensure local state also reflects description and name changes immediately
            Alert.alert("Success", "Playlist updated!");
        } else { Alert.alert("Error", "Could not update playlist."); }
        setIsProcessingAction(false);
    };

    const handleDeleteEntirePlaylist = () => {
        if (!playlistDetails) return;
        Alert.alert("Delete Playlist", `Delete "${playlistDetails.name}"? This cannot be undone.`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                    setIsProcessingAction(true);
                    const success = await deletePlaylist(playlistDetails.id);
                    if (success) {
                        Alert.alert("Deleted", `"${playlistDetails.name}" has been deleted.`);
                        navigation.navigate("Main", { screen: "LibraryTab", params: { screen: "LibraryScreen", params: { refreshTimestamp: Date.now() } }});
                    } else { Alert.alert("Error", "Could not delete playlist."); }
                    setIsProcessingAction(false);
                }}
        ]);
    };

    const showPlaylistOptions = () => {
        if (!playlistDetails) return;
        Alert.alert(playlistDetails.name, "Playlist Options", [
            { text: "Edit Details", onPress: openEditPlaylistModal },
            { text: "Delete Playlist", onPress: handleDeleteEntirePlaylist, style: "destructive" },
            { text: "Cancel", style: "cancel" },
        ], { cancelable: true });
    };

    const handleOpenTrackMoreOptions = (track) => { setSelectedTrackForTrackOptions(track); setIsTrackOptionsMenuVisible(true); };
    const closeTrackOptionsMenu = () => { setIsTrackOptionsMenuVisible(false); setSelectedTrackForTrackOptions(null); };

    // --- Menu Actions for Inline Modal ---
    const handleTrackMenuActionPlayNext = () => { if (selectedTrackForTrackOptions) playerActions.playNextInQueue(selectedTrackForTrackOptions); closeTrackOptionsMenu(); };
    const handleTrackMenuActionAddToQueue = () => { if (selectedTrackForTrackOptions) playerActions.addToQueue(selectedTrackForTrackOptions); closeTrackOptionsMenu(); };
    const handleTrackMenuActionAddToAnotherPlaylist = () => { setIsAddToOtherPlaylistModalVisible(true); setIsTrackOptionsMenuVisible(false); }; // Keep current menu closed
    const handleTrackMenuActionLikeUnlike = async () => {
        if (!selectedTrackForTrackOptions?.id) { closeTrackOptionsMenu(); return; }
        const trackId = selectedTrackForTrackOptions.id;
        const currentLikeStatus = selectedTrackIsLikedLocal;
        const shouldBeLiked = !currentLikeStatus;
        try {
            if (currentPlayerTrack?.id === trackId) { await playerActions.toggleLikeCurrentTrack(); }
            else { if (shouldBeLiked) await storageLikeTrack(trackId); else await storageUnlikeTrack(trackId); }
            setSelectedTrackIsLikedLocal(shouldBeLiked);
            Alert.alert("Like Status Updated", `"${selectedTrackForTrackOptions.title}" is now ${shouldBeLiked ? 'liked' : 'unliked'}.`);
        } catch (error) { Alert.alert("Error", "Could not update like status."); }
        // Do not close menu immediately, user sees icon change
    };
    const handleTrackMenuActionGoToAlbum = () => {
        const track = selectedTrackForTrackOptions;
        if (track?.album && track.album !== "—") {
            const albumTracks = globalAllTracks.filter(t => t.album === track.album && t.artist === track.artist); // Assuming album name is unique for an artist
            if (albumTracks.length > 0) {
                navigation.push('AlbumDetail', {
                    albumId: `${track.artist}-${track.album}`, // Create a more unique albumId if possible
                    albumName: track.album,
                    tracks: albumTracks,
                    artist: track.artist,
                    artwork: albumTracks.find(t => t.artwork)?.artwork || albumTracks[0]?.artwork
                });
            } else { Alert.alert("Album Not Found", `Could not find details for album "${track.album}".`); }
        }
        closeTrackOptionsMenu();
    };
    const handleTrackMenuActionGoToArtist = () => {
        const track = selectedTrackForTrackOptions;
        if (track?.artist) {
            const artistTracks = globalAllTracks.filter(t => t.artist === track.artist);
            if (artistTracks.length > 0) {
                navigation.push('ArtistDetail', {
                    artistId: track.artist,
                    artistName: track.artist,
                    tracks: artistTracks,
                    artwork: artistTracks.find(t=>t.artwork)?.artwork || artistTracks[0]?.artwork
                });
            } else { Alert.alert("Artist Not Found", `Could not find details for ${track.artist}.`); }
        }
        closeTrackOptionsMenu();
    };
    // --- End Menu Actions ---


    const handleActualTrackAddedToAnotherPlaylist = (playlist, track) => { Alert.alert("Track Added", `"${track.title}" was added to "${playlist.name}".`); };
    const handleRequestCreateNewPlaylistFromTrackMenu = () => {
        setIsAddToOtherPlaylistModalVisible(false);
        navigation.navigate("Main", { screen: "LibraryTab", params: { screen: "LibraryScreen", params: { action: "createPlaylist", prefillTrackId: selectedTrackForTrackOptions?.id } } });
    };

    const renderTrackItem = ({ item, index }) => (
        <TrackListItem item={item} index={index} onPress={() => handlePlayTrack(item, index)} onMoreOptionsPress={() => handleOpenTrackMoreOptions(item)} showArtwork={true} />
    );

    const ListHeader = () => {
        if (!playlistDetails) return null;
        const artworkUri = playlistDetails.artwork || DEFAULT_PLAYLIST_ARTWORK_DETAIL;
        return (
            <View className="items-center mb-4">
                <Image source={{ uri: artworkUri }} className="w-48 h-48 md:w-56 md:h-56 rounded-xl shadow-lg my-5 bg-zinc-700" />
                <Text className="text-2xl md:text-3xl font-bold text-custom-quaternary text-center px-4" numberOfLines={2}>{playlistDetails.name}</Text>
                {playlistDetails.description && (<Text className="text-sm text-custom-quaternary/70 mt-1 mb-2 text-center px-6" numberOfLines={3}>{playlistDetails.description}</Text>)}
                <Text className="text-sm text-custom-quaternary/70 mb-5">{tracks.length} {tracks.length === 1 ? "song" : "songs"}</Text>
                {tracks && tracks.length > 0 && (
                    <View className="flex-row w-full px-1 space-x-3 mb-6">
                        <TouchableOpacity onPress={handlePlayAllPlaylist} className="flex-1 bg-custom-primary py-3.5 rounded-full flex-row items-center justify-center active:opacity-80 shadow-md"><Ionicons name="play" size={20} color={TEXT_COLOR_ON_ACCENT} className="mr-1.5" /><Text className="font-semibold text-base" style={{ color: TEXT_COLOR_ON_ACCENT }}>Play</Text></TouchableOpacity>
                        <TouchableOpacity onPress={handleShufflePlaylist} className="flex-1 bg-custom-surface py-3.5 rounded-full flex-row items-center justify-center active:opacity-80 shadow-md border border-custom-border"><Ionicons name="shuffle" size={20} color={ICON_COLOR_PRIMARY} className="mr-1.5" /><Text className="text-custom-quaternary font-semibold text-base">Shuffle</Text></TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    if (isLoading) {
        return <View className="flex-1 justify-center items-center bg-custom-tertiary"><ActivityIndicator size="large" color={ICON_COLOR_ACCENT} /></View>;
    }
    if (!playlistDetails) {
        return (
            <View className="flex-1 justify-center items-center bg-custom-tertiary p-5">
                <StatusBar style="light" />
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.absoluteCloseButton, {top: insets.top + (Platform.OS === 'android' ? 10 : 10) }]} className="p-2 z-10 rounded-full active:bg-custom-surface/50"><Ionicons name="arrow-back" size={28} color={ICON_COLOR_PRIMARY} /></TouchableOpacity>
                <MaterialCommunityIcons name="alert-circle-outline" size={64} color={ICON_COLOR_SECONDARY} />
                <Text className="text-custom-quaternary/70 text-lg mt-4 text-center">Playlist not found.</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: BG_COLOR_SCREEN }}>
            <StatusBar style="light" />
            <View style={[styles.headerContainer, { backgroundColor: BG_COLOR_SCREEN, paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 12) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 rounded-full active:bg-custom-surface/50"><Ionicons name="arrow-back" size={26} color={ICON_COLOR_PRIMARY} /></TouchableOpacity>
                <Text className="flex-1 text-lg font-semibold text-custom-quaternary text-center mx-2" numberOfLines={1}>{playlistDetails.name}</Text>
                <TouchableOpacity onPress={showPlaylistOptions} className="p-2 rounded-full active:bg-custom-surface/50"><MaterialCommunityIcons name="dots-horizontal" size={26} color={ICON_COLOR_PRIMARY} /></TouchableOpacity>
            </View>

            <FlatList data={tracks} renderItem={renderTrackItem} keyExtractor={(item, index) => item.id?.toString() || `playlisttrack-${index}`} ListHeaderComponent={ListHeader} ListEmptyComponent={()=>(<View className="items-center px-5 mt-10"><MaterialCommunityIcons name="playlist-music-outline" size={56} color={ICON_COLOR_SECONDARY} /><Text className="text-lg font-semibold text-custom-quaternary/70 mt-4 text-center">This playlist is empty.</Text><Text className="text-sm text-custom-quaternary/50 mt-2 text-center">Add some songs!</Text></View>)} contentContainerStyle={styles.flatListContent} showsVerticalScrollIndicator={false} extraData={playlistDetails.name + tracks.length + playlistDetails.description} />

            {isProcessingAction && (<View style={styles.processingActionOverlay}><ActivityIndicator size="large" color={ICON_COLOR_ACCENT} /></View>)}

            <Modal animationType="fade" transparent={true} visible={isEditPlaylistModalVisible} onRequestClose={() => setIsEditPlaylistModalVisible(false)}>
                <View className="flex-1 justify-center items-center bg-black/80 px-5">
                    <View className="bg-custom-surface w-full p-6 rounded-xl shadow-xl">
                        <Text className="text-xl font-bold text-custom-quaternary mb-5 text-center">Edit Playlist</Text>
                        <TextInput placeholder="Playlist Name" placeholderTextColor={ICON_COLOR_SECONDARY} value={editingPlaylistName} onChangeText={setEditingPlaylistName} className="bg-custom-tertiary text-custom-quaternary p-4 rounded-lg mb-4 border border-custom-border text-base" autoFocus={true} />
                        <TextInput placeholder="Description (optional)" placeholderTextColor={ICON_COLOR_SECONDARY} value={editingPlaylistDescription} onChangeText={setEditingPlaylistDescription} className="bg-custom-tertiary text-custom-quaternary p-4 rounded-lg mb-6 border border-custom-border text-base h-20" multiline={true} numberOfLines={3} textAlignVertical="top" />
                        <View className="flex-row justify-end space-x-3">
                            <TouchableOpacity onPress={() => setIsEditPlaylistModalVisible(false)} className="py-3 px-5 rounded-lg bg-zinc-600 active:bg-zinc-500"><Text className="text-custom-quaternary font-semibold">Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleSavePlaylistDetails} className="py-3 px-5 rounded-lg bg-custom-primary active:opacity-80"><Text className="font-semibold" style={{ color: TEXT_COLOR_ON_ACCENT }}>Save</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Встроенное модальное окно опций трека */}
            {selectedTrackForTrackOptions && isTrackOptionsMenuVisible && (
                <Modal animationType="fade" transparent={true} visible={isTrackOptionsMenuVisible} onRequestClose={closeTrackOptionsMenu}>
                    <TouchableOpacity style={styles.optionsModalOverlay} activeOpacity={1} onPress={closeTrackOptionsMenu}>
                        <View style={styles.optionsModalContentContainer}>
                            <View onStartShouldSetResponder={() => true} className="bg-custom-surface w-full p-2 rounded-t-2xl shadow-xl border-t border-x border-custom-border">
                                {/* Заголовок с информацией о треке */}
                                <View className="py-3 px-4 items-center border-b border-custom-border/30 mb-1">
                                    <Text className="text-lg font-bold text-custom-quaternary text-center" numberOfLines={1}>{selectedTrackForTrackOptions.title}</Text>
                                    <Text className="text-sm text-custom-quaternary/70 text-center" numberOfLines={1}>{selectedTrackForTrackOptions.artist}</Text>
                                </View>

                                {/* Опции меню */}
                                <TouchableOpacity onPress={handleTrackMenuActionPlayNext} style={styles.optionItem} className="active:bg-custom-surface-hover"><Ionicons name="play-forward-outline" size={22} color={ICON_COLOR_PRIMARY} style={styles.optionIcon}/><Text style={styles.optionText}>Play Next</Text></TouchableOpacity>
                                <TouchableOpacity onPress={handleTrackMenuActionAddToQueue} style={styles.optionItem} className="active:bg-custom-surface-hover"><Ionicons name="list-circle-outline" size={22} color={ICON_COLOR_PRIMARY} style={styles.optionIcon}/><Text style={styles.optionText}>Add to Queue</Text></TouchableOpacity>
                                <TouchableOpacity onPress={handleTrackMenuActionAddToAnotherPlaylist} style={styles.optionItem} className="active:bg-custom-surface-hover"><Ionicons name="add-circle-outline" size={22} color={ICON_COLOR_PRIMARY} style={styles.optionIcon}/><Text style={styles.optionText}>Add to Playlist...</Text></TouchableOpacity>
                                <TouchableOpacity onPress={handleTrackMenuActionLikeUnlike} style={styles.optionItem} className="active:bg-custom-surface-hover"><Ionicons name={selectedTrackIsLikedLocal ? "heart" : "heart-outline"} size={22} color={selectedTrackIsLikedLocal ? ICON_COLOR_ACCENT : ICON_COLOR_PRIMARY} style={styles.optionIcon}/><Text style={styles.optionText}>{selectedTrackIsLikedLocal ? "Unlike" : "Like"}</Text></TouchableOpacity>

                                {selectedTrackForTrackOptions.album && selectedTrackForTrackOptions.album !== "—" && (
                                    <TouchableOpacity onPress={handleTrackMenuActionGoToAlbum} style={styles.optionItem} className="active:bg-custom-surface-hover"><Ionicons name="albums-outline" size={22} color={ICON_COLOR_PRIMARY} style={styles.optionIcon}/><Text style={styles.optionText}>Go to Album</Text></TouchableOpacity>
                                )}
                                {selectedTrackForTrackOptions.artist && (
                                    <TouchableOpacity onPress={handleTrackMenuActionGoToArtist} style={styles.optionItem} className="active:bg-custom-surface-hover"><Ionicons name="person-outline" size={22} color={ICON_COLOR_PRIMARY} style={styles.optionIcon}/><Text style={styles.optionText}>Go to Artist</Text></TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={handleMenuActionRemoveFromThisPlaylist} style={styles.optionItem} className="active:bg-custom-surface-hover"><Ionicons name="trash-outline" size={22} color={ICON_COLOR_PRIMARY} style={styles.optionIcon}/><Text style={styles.optionText}>Remove from this Playlist</Text></TouchableOpacity>

                                <TouchableOpacity onPress={closeTrackOptionsMenu} style={[styles.optionItem, styles.cancelOptionItem]} className="active:bg-custom-surface-hover">
                                    <Text style={[styles.optionText, styles.cancelOptionText]}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}

            {selectedTrackForTrackOptions && ( // This modal is for adding to *another* playlist
                <AddToPlaylistModal
                    visible={isAddToOtherPlaylistModalVisible}
                    onClose={() => setIsAddToOtherPlaylistModalVisible(false) }
                    trackToAdd={selectedTrackForTrackOptions}
                    onTrackAdded={handleActualTrackAddedToAnotherPlaylist}
                    onCreateNewPlaylist={handleRequestCreateNewPlaylistFromTrackMenu}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 12, zIndex: 10, },
    flatListContent: { paddingHorizontal: 16, paddingBottom: 90 },
    processingActionOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    absoluteCloseButton: { position: 'absolute', /* top is set dynamically */ left: 15, zIndex: 10,},
    // Styles for inline track options modal (copied and adapted from AlbumDetailScreen)
    optionsModalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    optionsModalContentContainer: { width: '100%' },
    optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: MENU_BORDER_COLOR, },
    optionIcon: { marginRight: 16, width: 24, textAlign: 'center' },
    optionText: { fontSize: 16, color: ICON_COLOR_PRIMARY },
    cancelOptionItem: { marginTop: 8, borderTopWidth: 1, borderColor: MENU_BORDER_COLOR, },
    cancelOptionText: { color: ICON_COLOR_ACCENT, textAlign: 'center', fontWeight: '600' },
});

export default PlaylistDetailScreen;
