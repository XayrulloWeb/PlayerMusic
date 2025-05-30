// utils/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values'; // Для uuid, если используете
import { v4 as uuidv4 } from 'uuid';   // Библиотека для генерации UUID

const LIKED_TRACKS_KEY = '@MyApp:LikedTracks';
const USER_PLAYLISTS_KEY = '@MyApp:UserPlaylists'; // Новый ключ
// УДАЛЕНО ДУБЛИРУЮЩЕЕСЯ ОБЪЯВЛЕНИЕ LIKED_TRACKS_KEY

// --- Функции для лайкнутых треков ---
export const getLikedTracksIds = async () => {
    try {
        const jsonValue = await AsyncStorage.getItem(LIKED_TRACKS_KEY);
        const likedIds = jsonValue != null ? JSON.parse(jsonValue) : [];
        return Array.isArray(likedIds) ? likedIds.map(id => String(id)) : [];
    } catch (error) {
        console.error('[Storage] Error reading liked tracks:', error);
        return [];
    }
};

export const isTrackLiked = async (trackId) => {
    if (trackId === null || trackId === undefined || String(trackId).trim() === '') {
        return false;
    }
    try {
        const likedIds = await getLikedTracksIds();
        return likedIds.includes(String(trackId));
    } catch (error) {
        console.error(`[Storage] Error checking if track ${trackId} is liked:`, error);
        return false;
    }
};

export const likeTrack = async (trackId) => {
    if (trackId === null || trackId === undefined || String(trackId).trim() === '') {
        console.warn('[Storage] likeTrack called with invalid trackId.');
        return false;
    }
    try {
        const likedIds = await getLikedTracksIds();
        const trackIdStr = String(trackId);

        if (!likedIds.includes(trackIdStr)) {
            const newLikedIds = [...likedIds, trackIdStr];
            await AsyncStorage.setItem(LIKED_TRACKS_KEY, JSON.stringify(newLikedIds));
            console.log(`[Storage] Track ${trackIdStr} liked and saved.`);
        }
        return true;
    } catch (error) {
        console.error(`[Storage] Error liking track ${trackId}:`, error);
        return false;
    }
};

export const unlikeTrack = async (trackId) => {
    if (trackId === null || trackId === undefined || String(trackId).trim() === '') {
        console.warn('[Storage] unlikeTrack called with invalid trackId.');
        return false;
    }
    try {
        let likedIds = await getLikedTracksIds();
        const trackIdStr = String(trackId);
        const initialLength = likedIds.length;

        likedIds = likedIds.filter(id => id !== trackIdStr);

        if (likedIds.length < initialLength) {
            await AsyncStorage.setItem(LIKED_TRACKS_KEY, JSON.stringify(likedIds));
            console.log(`[Storage] Track ${trackIdStr} unliked and saved.`);
        }
        return true;
    } catch (error) {
        console.error(`[Storage] Error unliking track ${trackId}:`, error);
        return false;
    }
};

export const clearAllLikedTracks = async () => {
    try {
        await AsyncStorage.removeItem(LIKED_TRACKS_KEY);
        console.log('[Storage] All liked tracks cleared.');
        return true;
    } catch (error) {
        console.error('[Storage] Error clearing all liked tracks:', error);
        return false;
    }
};


// --- НОВЫЕ ФУНКЦИИ ДЛЯ ПЛЕЙЛИСТОВ ---

export const getUserPlaylists = async () => {
    try {
        const jsonValue = await AsyncStorage.getItem(USER_PLAYLISTS_KEY);
        return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
        console.error('[Storage] Error fetching user playlists:', e);
        return [];
    }
};

const saveUserPlaylists = async (playlists) => {
    try {
        const jsonValue = JSON.stringify(playlists);
        await AsyncStorage.setItem(USER_PLAYLISTS_KEY, jsonValue);
        return true;
    } catch (e) {
        console.error('[Storage] Error saving user playlists:', e);
        return false;
    }
};

export const createPlaylist = async (name, description = '') => {
    if (!name || name.trim() === '') {
        console.warn('[Storage] Playlist name cannot be empty.');
        return null;
    }
    try {
        const playlists = await getUserPlaylists();
        const newPlaylist = {
            id: uuidv4(),
            name: name.trim(),
            description: description.trim(),
            artwork: null,
            trackIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        playlists.push(newPlaylist);
        await saveUserPlaylists(playlists);
        console.log(`[Storage] Playlist "${newPlaylist.name}" created with ID ${newPlaylist.id}`);
        return newPlaylist;
    } catch (e) {
        console.error('[Storage] Error creating playlist:', e);
        return null;
    }
};

export const deletePlaylist = async (playlistId) => {
    try {
        let playlists = await getUserPlaylists();
        const initialLength = playlists.length;
        playlists = playlists.filter(p => p.id !== playlistId);
        if (playlists.length < initialLength) {
            await saveUserPlaylists(playlists);
            console.log(`[Storage] Playlist ${playlistId} deleted.`);
            return true;
        }
        console.warn(`[Storage] Playlist ${playlistId} not found for deletion.`);
        return false;
    } catch (e) {
        console.error(`[Storage] Error deleting playlist ${playlistId}:`, e);
        return false;
    }
};

export const addTrackToPlaylist = async (playlistId, trackId) => {
    if (!trackId) return null;
    try {
        const playlists = await getUserPlaylists();
        const playlistIndex = playlists.findIndex(p => p.id === playlistId);

        if (playlistIndex === -1) {
            console.warn(`[Storage] Playlist ${playlistId} not found for adding track.`);
            return null;
        }

        const playlist = playlists[playlistIndex];
        const trackIdStr = trackId.toString();

        if (playlist.trackIds.includes(trackIdStr)) {
            console.log(`[Storage] Track ${trackIdStr} already in playlist ${playlist.name}.`);
            return playlist;
        }

        playlist.trackIds.push(trackIdStr);
        playlist.updatedAt = Date.now();

        playlists[playlistIndex] = playlist;
        await saveUserPlaylists(playlists);
        console.log(`[Storage] Track ${trackIdStr} added to playlist ${playlist.name}.`);
        return playlist;
    } catch (e) {
        console.error(`[Storage] Error adding track ${trackId} to playlist ${playlistId}:`, e);
        return null;
    }
};

export const removeTrackFromPlaylist = async (playlistId, trackId) => {
    if (!trackId) return null;
    try {
        const playlists = await getUserPlaylists();
        const playlistIndex = playlists.findIndex(p => p.id === playlistId);

        if (playlistIndex === -1) {
            console.warn(`[Storage] Playlist ${playlistId} not found for removing track.`);
            return null;
        }

        const playlist = playlists[playlistIndex];
        const trackIdStr = trackId.toString();
        const initialTrackCount = playlist.trackIds.length;

        playlist.trackIds = playlist.trackIds.filter(id => id !== trackIdStr);

        if (playlist.trackIds.length < initialTrackCount) {
            playlist.updatedAt = Date.now();
            playlists[playlistIndex] = playlist;
            await saveUserPlaylists(playlists);
            console.log(`[Storage] Track ${trackIdStr} removed from playlist ${playlist.name}.`);
            return playlist;
        }
        console.log(`[Storage] Track ${trackIdStr} not found in playlist ${playlist.name} to remove.`);
        return playlist;
    } catch (e) {
        console.error(`[Storage] Error removing track ${trackId} from playlist ${playlistId}:`, e);
        return null;
    }
};


export const updatePlaylistDetails = async (playlistId, updates) => {
    if (!playlistId || !updates || Object.keys(updates).length === 0) {
        console.warn('[Storage] updatePlaylistDetails: Invalid playlistId or no updates provided.');
        return null;
    }
    try {
        const playlists = await getUserPlaylists();
        const playlistIndex = playlists.findIndex(p => p.id === playlistId);

        if (playlistIndex === -1) {
            console.warn(`[Storage] Playlist ${playlistId} not found for update.`);
            return null;
        }

        // Обновляем только разрешенные поля
        const allowedUpdates = {};
        if (updates.name !== undefined) allowedUpdates.name = String(updates.name).trim();
        if (updates.description !== undefined) allowedUpdates.description = String(updates.description).trim();
        if (updates.artwork !== undefined) allowedUpdates.artwork = updates.artwork; // Может быть null для удаления

        playlists[playlistIndex] = {
            ...playlists[playlistIndex],
            ...allowedUpdates, // Применяем только разрешенные и обработанные обновления
            updatedAt: Date.now(),
        };

        await saveUserPlaylists(playlists);
        console.log(`[Storage] Playlist ${playlistId} updated.`);
        return playlists[playlistIndex];
    } catch (e) {
        console.error(`[Storage] Error updating playlist ${playlistId}:`, e);
        return null;
    }
};
