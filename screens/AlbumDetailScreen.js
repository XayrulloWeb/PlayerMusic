// screens/AlbumDetailScreen.js
import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, /* StatusBar as RNStatusBar, */ Image, FlatList, Alert, StyleSheet, ScrollView, Modal } from 'react-native'; // RNStatusBar removed
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar'; // expo-status-bar
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddToPlaylistModal from '../components/AddToPlaylistModal';
import TrackListItem from '../components/TrackListItem';
// import TrackOptionsMenuModal from '../components/TrackOptionsMenuModal';
import { usePlayer } from '../context/PlayerContext';
import { allTracksData as globalAllTracks } from './LibraryScreen';
import { isTrackLiked as checkIsTrackLiked, likeTrack as storageLikeTrack, unlikeTrack as storageUnlikeTrack } from '../utils/storage';

// Цвета и константы (адаптируйте под вашу Tailwind тему)
const ICON_COLOR_PRIMARY = '#FAFAFA';
const ICON_COLOR_SECONDARY = '#A0A0A0';
const ICON_COLOR_ACCENT = '#8DEEED';
const TEXT_ON_ACCENT_BUTTON_COLOR = '#030318';
const BG_COLOR_SCREEN = '#030318';
const MENU_BG_COLOR = '#1F2937';       // Используется во встроенной модалке
const MENU_BORDER_COLOR = '#374151';   // Используется во встроенной модалке
// const MENU_ITEM_ACTIVE_BG = '#374151';

const AlbumDetailScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { currentTrack: currentPlayerTrack, isLiked: isCurrentTrackLikedByContext, actions: playerActions } = usePlayer();

    const params = route.params || {};
    const {
        albumName = "Album",
        tracks: initialTracks = [],
        artist = "Unknown Artist",
        artwork
    } = params;
    const insets = useSafeAreaInsets();

    const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);
    const [selectedTrackForOptions, setSelectedTrackForOptions] = useState(null);
    const [isAddToPlaylistModalVisible, setIsAddToPlaylistModalVisible] = useState(false);
    const [selectedTrackIsLiked, setSelectedTrackIsLiked] = useState(false);

    useEffect(() => {
        const checkIfSelectedTrackIsLiked = async () => {
            if (selectedTrackForOptions?.id) {
                if (currentPlayerTrack?.id === selectedTrackForOptions.id) {
                    setSelectedTrackIsLiked(isCurrentTrackLikedByContext);
                } else {
                    setSelectedTrackIsLiked(await checkIsTrackLiked(selectedTrackForOptions.id));
                }
            }
        };
        if (isOptionsMenuVisible && selectedTrackForOptions) {
            checkIfSelectedTrackIsLiked();
        }
    }, [isOptionsMenuVisible, selectedTrackForOptions, currentPlayerTrack, isCurrentTrackLikedByContext]);

    const handlePlayTrack = useCallback((selectedTrack, index) => {
        if (!selectedTrack || !selectedTrack.url) {
            Alert.alert("Cannot Play", "This track does not have a valid URL."); return;
        }
        navigation.navigate('Player', { track: selectedTrack, playlist: initialTracks.filter(t => t && t.url), currentIndex: index });
    }, [navigation, initialTracks]);

    const handlePlayAll = useCallback(() => {
        const playableTracks = initialTracks.filter(t => t && t.url);
        if (playableTracks.length > 0) {
            const firstPlayableIndex = initialTracks.findIndex(t => t.id === playableTracks[0].id);
            handlePlayTrack(playableTracks[0], firstPlayableIndex >= 0 ? firstPlayableIndex : 0);
        } else { Alert.alert("No Playable Tracks", "This album contains no playable tracks."); }
    }, [initialTracks, handlePlayTrack]);

    const handleShufflePlay = useCallback(() => {
        const playableTracks = initialTracks.filter(t => t && t.url);
        if (playableTracks.length > 0) {
            const shuffled = [...playableTracks].sort(() => Math.random() - 0.5);
            navigation.navigate('Player', { track: shuffled[0], playlist: shuffled, currentIndex: 0 });
        } else { Alert.alert("No Playable Tracks", "This album contains no playable tracks to shuffle."); }
    }, [initialTracks, navigation]);

    const handleOpenMoreOptions = (track) => {
        setSelectedTrackForOptions(track);
        setIsOptionsMenuVisible(true);
        console.log("[AlbumDetail] Opening options for track:", track.title);
    };

    const closeOptionsMenu = () => {
        setIsOptionsMenuVisible(false);
        setSelectedTrackForOptions(null);
    };

    const handleMenuActionPlayNext = () => {
        if (selectedTrackForOptions) playerActions.playNextInQueue(selectedTrackForOptions);
        closeOptionsMenu();
    };
    const handleMenuActionAddToQueue = () => {
        if (selectedTrackForOptions) playerActions.addToQueue(selectedTrackForOptions);
        closeOptionsMenu();
    };
    const handleMenuActionAddToPlaylist = () => {
        setIsAddToPlaylistModalVisible(true);
        setIsOptionsMenuVisible(false);
    };
    const handleMenuActionLikeUnlikeTrack = async () => {
        if (!selectedTrackForOptions || !selectedTrackForOptions.id) { closeOptionsMenu(); return; }
        const trackId = selectedTrackForOptions.id;
        const currentLikeStatus = selectedTrackIsLiked;
        const shouldBeLiked = !currentLikeStatus;
        try {
            if (currentPlayerTrack?.id === trackId) {
                await playerActions.toggleLikeCurrentTrack();
            } else {
                if (shouldBeLiked) await storageLikeTrack(trackId); else await storageUnlikeTrack(trackId);
            }
            setSelectedTrackIsLiked(shouldBeLiked);
            Alert.alert("Like Status Updated", `"${selectedTrackForOptions.title}" is now ${shouldBeLiked ? 'liked' : 'unliked'}.`);
        } catch (error) { Alert.alert("Error", "Could not update like status."); }
    };
    const handleMenuActionGoToArtist = () => {
        if (selectedTrackForOptions?.artist) {
            const artistTracks = globalAllTracks.filter(t => t.artist === selectedTrackForOptions.artist);
            if (artistTracks.length > 0) {
                navigation.push('ArtistDetail', {
                    artistId: selectedTrackForOptions.artist, artistName: selectedTrackForOptions.artist,
                    tracks: artistTracks, artwork: artistTracks.find(t => t.artwork)?.artwork || artistTracks[0]?.artwork
                });
            } else { Alert.alert("Artist Not Found", `Could not find details for ${selectedTrackForOptions.artist}.`); }
        }
        closeOptionsMenu();
    };

    const handleActualTrackAddedToPlaylist = (playlist, track) => {
        Alert.alert("Track Added", `"${track.title}" was added to playlist "${playlist.name}".`);
    };
    const handleRequestCreateNewPlaylistFromModal = () => {
        setIsAddToPlaylistModalVisible(false);
        navigation.navigate("Main", {
            screen: "LibraryTab",
            params: { screen: "LibraryScreen", params: { action: "createPlaylist", prefillTrackId: selectedTrackForOptions?.id } }
        });
    };

    const renderTrackItem = ({ item, index }) => (
        <TrackListItem
            item={item}
            index={index}
            onPress={() => handlePlayTrack(item, index)}
            onMoreOptionsPress={handleOpenMoreOptions}
            showArtwork={false}
        />
    );

    const ListHeader = () => (
        <View className="items-center mb-4">
            {artwork && (<Image source={{ uri: artwork }} className="w-48 h-48 md:w-56 md:h-56 rounded-xl shadow-lg my-5 bg-zinc-700" />)}
            <Text className="text-2xl md:text-3xl font-bold text-custom-quaternary text-center px-4" numberOfLines={2}>{albumName}</Text>
            <TouchableOpacity onPress={() => {
                if (artist && artist !== "Unknown Artist") {
                    const artistTracks = globalAllTracks.filter(t => t.artist === artist);
                    const mainArtistArtwork = initialTracks.find(t => t.artist === artist && t.artwork)?.artwork || artwork;
                    navigation.navigate('ArtistDetail', { artistId: artist, artistName: artist, tracks: artistTracks, artwork: mainArtistArtwork });
                }
            }}>
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
            {initialTracks && initialTracks.length > 0 && (<Text className="text-lg font-semibold text-custom-quaternary self-start mb-2">Tracks ({initialTracks.length})</Text>)}
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: BG_COLOR_SCREEN }}>
            <StatusBar style="light" />
            <View style={[styles.headerContainer, { backgroundColor: BG_COLOR_SCREEN, paddingTop: insets.top + (Platform.OS === 'android' ? 8 : 12) }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 rounded-full active:bg-custom-surface/50"><Ionicons name="arrow-back" size={26} color={ICON_COLOR_PRIMARY} /></TouchableOpacity>
                <Text className="flex-1 text-lg font-semibold text-custom-quaternary text-center mx-2" numberOfLines={1}>{albumName}</Text>
                <TouchableOpacity className="p-2 rounded-full active:bg-custom-surface/50"><View className="w-[26px]" /></TouchableOpacity>
            </View>

            {initialTracks && initialTracks.length > 0 ? (
                <FlatList data={initialTracks} renderItem={renderTrackItem} keyExtractor={(item, index) => item.id?.toString() || `albumtrack-${index}`} ListHeaderComponent={ListHeader} contentContainerStyle={styles.flatListContent} showsVerticalScrollIndicator={false} />
            ) : (
                <ScrollView contentContainerStyle={styles.emptyContainer}><ListHeader /><MaterialCommunityIcons name="album-outline" size={48} color={ICON_COLOR_SECONDARY} /><Text className="text-custom-quaternary/70 mt-4 text-lg text-center">No tracks found in this album.</Text></ScrollView>
            )}

            {selectedTrackForOptions && (
                <AddToPlaylistModal
                    visible={isAddToPlaylistModalVisible}
                    onClose={() => setIsAddToPlaylistModalVisible(false)}
                    trackToAdd={selectedTrackForOptions}
                    onTrackAdded={handleActualTrackAddedToPlaylist}
                    onCreateNewPlaylist={handleRequestCreateNewPlaylistFromModal}
                />
            )}

            {selectedTrackForOptions && isOptionsMenuVisible && (
                <Modal animationType="fade" transparent={true} visible={isOptionsMenuVisible} onRequestClose={closeOptionsMenu}>
                    <TouchableOpacity style={styles.optionsModalOverlay} activeOpacity={1} onPress={closeOptionsMenu}>
                        <View style={styles.optionsModalContentContainer}>
                            <View onStartShouldSetResponder={() => true} className="bg-custom-surface w-full p-2 rounded-t-2xl shadow-xl border-t border-x border-custom-border">
                                <View className="py-3 px-4 items-center border-b border-custom-border/30 mb-1">
                                    <Text className="text-lg font-bold text-custom-quaternary text-center" numberOfLines={1}>{selectedTrackForOptions.title}</Text>
                                    <Text className="text-sm text-custom-quaternary/70 text-center" numberOfLines={1}>{selectedTrackForOptions.artist}</Text>
                                </View>

                                <TouchableOpacity onPress={handleMenuActionPlayNext} style={styles.optionItem} className="active:bg-custom-surface-hover"><Ionicons name="play-forward-outline" size={22} color={ICON_COLOR_PRIMARY} style={styles.optionIcon}/><Text style={styles.optionText}>Play Next</Text></TouchableOpacity>
                                <TouchableOpacity onPress={handleMenuActionAddToQueue} style={styles.optionItem} className="active:bg-custom-surface-hover"><Ionicons name="list-circle-outline" size={22} color={ICON_COLOR_PRIMARY} style={styles.optionIcon}/><Text style={styles.optionText}>Add to Queue</Text></TouchableOpacity>
                                <TouchableOpacity onPress={handleMenuActionAddToPlaylist} style={styles.optionItem} className="active:bg-custom-surface-hover"><Ionicons name="add-circle-outline" size={22} color={ICON_COLOR_PRIMARY} style={styles.optionIcon}/><Text style={styles.optionText}>Add to Playlist...</Text></TouchableOpacity>
                                <TouchableOpacity onPress={handleMenuActionLikeUnlikeTrack} style={styles.optionItem} className="active:bg-custom-surface-hover"><Ionicons name={selectedTrackIsLiked ? "heart" : "heart-outline"} size={22} color={selectedTrackIsLiked ? ICON_COLOR_ACCENT : ICON_COLOR_PRIMARY} style={styles.optionIcon}/><Text style={styles.optionText}>{selectedTrackIsLiked ? "Unlike" : "Like"}</Text></TouchableOpacity>
                                <TouchableOpacity onPress={handleMenuActionGoToArtist} style={styles.optionItem} className="active:bg-custom-surface-hover"><Ionicons name="person-outline" size={22} color={ICON_COLOR_PRIMARY} style={styles.optionIcon}/><Text style={styles.optionText}>Go to Artist</Text></TouchableOpacity>

                                <TouchableOpacity onPress={closeOptionsMenu} style={[styles.optionItem, styles.cancelOptionItem]} className="active:bg-custom-surface-hover">
                                    <Text style={[styles.optionText, styles.cancelOptionText]}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 12, zIndex: 10, },
    flatListContent: { paddingHorizontal: 16, paddingBottom: 90 },
    emptyContainer: { flexGrow:1, justifyContent: 'center', alignItems: 'center', padding: 20},
    optionsModalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    optionsModalContentContainer: { width: '100%' },
    optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: MENU_BORDER_COLOR, },
    optionIcon: { marginRight: 16, width: 24, textAlign: 'center' },
    optionText: { fontSize: 16, color: ICON_COLOR_PRIMARY },
    cancelOptionItem: { marginTop: 8, borderTopWidth: 1, borderColor: MENU_BORDER_COLOR, },
    cancelOptionText: { color: ICON_COLOR_ACCENT, textAlign: 'center', fontWeight: '600' },
});

export default AlbumDetailScreen;
