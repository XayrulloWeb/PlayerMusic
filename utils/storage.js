import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const LIKED_TRACKS_KEY = '@MyApp:LikedTracks';
const USER_PLAYLISTS_KEY = '@MyApp:UserPlaylists';

// In-memory cache
let cachedLikedTracks = null;
let cachedPlaylists = null;

// --- Функции для лайкнутых треков ---
export const getLikedTracksIds = async () => {
    if (cachedLikedTracks) return cachedLikedTracks;
    try {
        const jsonValue = await AsyncStorage.getItem(LIKED_TRACKS_KEY);
        const likedIds = jsonValue ? JSON.parse(jsonValue) : [];
        cachedLikedTracks = Array.isArray(likedIds) ? likedIds.map(id => String(id)) : [];
        return cachedLikedTracks;
    } catch (error) {
        return [];
    }
};

export const isTrackLiked = async (trackId) => {
    if (!trackId || typeof trackId !== 'string' || trackId.trim() === '') {
        return false;
    }
    try {
        const likedIds = await getLikedTracksIds();
        return likedIds.includes(trackId);
    } catch (error) {
        return false;
    }
};

export const likeTrack = async (trackId) => {
    if (!trackId || typeof trackId !== 'string' || trackId.trim() === '') {
        return false;
    }
    try {
        const likedIds = await getLikedTracksIds();
        if (!likedIds.includes(trackId)) {
            cachedLikedTracks = [...likedIds, trackId];
            await AsyncStorage.setItem(LIKED_TRACKS_KEY, JSON.stringify(cachedLikedTracks));
        }
        return true;
    } catch (error) {
        return false;
    }
};

export const unlikeTrack = async (trackId) => {
    if (!trackId || typeof trackId !== 'string' || trackId.trim() === '') {
        return false;
    }
    try {
        const likedIds = await getLikedTracksIds();
        if (likedIds.includes(trackId)) {
            cachedLikedTracks = likedIds.filter(id => id !== trackId);
            await AsyncStorage.setItem(LIKED_TRACKS_KEY, JSON.stringify(cachedLikedTracks));
        }
        return true;
    } catch (error) {
        return false;
    }
};

export const clearAllLikedTracks = async () => {
    try {
        cachedLikedTracks = [];
        await AsyncStorage.removeItem(LIKED_TRACKS_KEY);
        return true;
    } catch (error) {
        return false;
    }
};

// --- Функции для плейлистов ---
export const getUserPlaylists = async () => {
    if (cachedPlaylists) return cachedPlaylists;
    try {
        const jsonValue = await AsyncStorage.getItem(USER_PLAYLISTS_KEY);
        cachedPlaylists = jsonValue ? JSON.parse(jsonValue) : [];
        return cachedPlaylists;
    } catch (error) {
        return [];
    }
};

const saveUserPlaylists = async (playlists) => {
    try {
        cachedPlaylists = playlists;
        await AsyncStorage.setItem(USER_PLAYLISTS_KEY, JSON.stringify(playlists));
        return true;
    } catch (error) {
        return false;
    }
};

export const createPlaylist = async (name, description = '') => {
    if (!name || typeof name !== 'string' || name.trim() === '') {
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
        return newPlaylist;
    } catch (error) {
        return null;
    }
};

export const deletePlaylist = async (playlistId) => {
    if (!playlistId || typeof playlistId !== 'string') {
        return false;
    }
    try {
        const playlists = await getUserPlaylists();
        const updatedPlaylists = playlists.filter(p => p.id !== playlistId);
        if (updatedPlaylists.length < playlists.length) {
            await saveUserPlaylists(updatedPlaylists);
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
};

export const addTrackToPlaylist = async (playlistId, trackId) => {
    if (!playlistId || !trackId || typeof trackId !== 'string') {
        return null;
    }
    try {
        const playlists = await getUserPlaylists();
        const playlistIndex = playlists.findIndex(p => p.id === playlistId);
        if (playlistIndex === -1) {
            return null;
        }
        const playlist = playlists[playlistIndex];
        if (!playlist.trackIds.includes(trackId)) {
            playlist.trackIds.push(trackId);
            playlist.updatedAt = Date.now();
            playlists[playlistIndex] = playlist;
            await saveUserPlaylists(playlists);
        }
        return playlist;
    } catch (error) {
        return null;
    }
};

export const removeTrackFromPlaylist = async (playlistId, trackId) => {
    if (!playlistId || !trackId || typeof trackId !== 'string') {
        return null;
    }
    try {
        const playlists = await getUserPlaylists();
        const playlistIndex = playlists.findIndex(p => p.id === playlistId);
        if (playlistIndex === -1) {
            return null;
        }
        const playlist = playlists[playlistIndex];
        const initialTrackCount = playlist.trackIds.length;
        playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
        if (playlist.trackIds.length < initialTrackCount) {
            playlist.updatedAt = Date.now();
            playlists[playlistIndex] = playlist;
            await saveUserPlaylists(playlists);
        }
        return playlist;
    } catch (error) {
        return null;
    }
};

export const updatePlaylistDetails = async (playlistId, updates) => {
    if (!playlistId || !updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
        return null;
    }
    try {
        const playlists = await getUserPlaylists();
        const playlistIndex = playlists.findIndex(p => p.id === playlistId);
        if (playlistIndex === -1) {
            return null;
        }
        const allowedUpdates = {};
        if (typeof updates.name === 'string') allowedUpdates.name = updates.name.trim();
        if (typeof updates.description === 'string') allowedUpdates.description = updates.description.trim();
        if (updates.artwork !== undefined) allowedUpdates.artwork = updates.artwork;
        playlists[playlistIndex] = {
            ...playlists[playlistIndex],
            ...allowedUpdates,
            updatedAt: Date.now(),
        };
        await saveUserPlaylists(playlists);
        return playlists[playlistIndex];
    } catch (error) {
        return null;
    }
};
