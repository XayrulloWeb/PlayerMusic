// screens/SearchScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ImageBackground, Image, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import allTracksDataForSearch from '../assets/tracks.json'; // Импорт данных


const COLOR_PLACEHOLDER = '#A0A0A0'; // Пример: custom-text-secondary
const COLOR_TEXT_PRIMARY_HEX = '#FAFAFA'; // custom-quaternary
const COLOR_ICON_INACTIVE_HEX = '#A0A0A0'; // Пример: custom-text-secondary

// Категории (оставим их для визуала, но поиск по ним пока не делаем)
const searchCategories = [
    { id: 'cat1', name: 'Pop', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bXVzaWN8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=300&q=60' },
    { id: 'cat2', name: 'Hip Hop', image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8bXVzaWN8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=300&q=60' },
    { id: 'cat3', name: 'Electronic', image: 'https://images.unsplash.com/photo-1516223725307-6f76b9ec8742?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGVsZWN0cm9uaWMlMjBtdXNpY3xlbnwwfHwwfHx8MA%3D&auto=format&fit=crop&w=300&q=60' },
    { id: 'cat4', name: 'Indie', image: 'https://images.unsplash.com/photo-1483954002438-3084c974b8is?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGluZGllJTIwbXVzaWN8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=300&q=60' },
];
const screenWidth = Dimensions.get('window').width;
const cardMargin = 12;
const numColumns = 2;
const cardWidth = (screenWidth - (20 * 2) - (cardMargin * (numColumns -1))) / numColumns;

const CategoryCard = ({ item, onPress }) => (
    <TouchableOpacity onPress={onPress} className="mb-3" style={{ width: Math.floor(cardWidth) }}>
        <ImageBackground source={{ uri: item.image }} className="h-28 w-full rounded-lg overflow-hidden justify-end p-3" imageStyle={{ borderRadius: 8 }}>
            <View className="absolute inset-0 bg-black/50 rounded-lg" />
            <Text className="text-custom-quaternary font-bold text-base relative z-10">{item.name}</Text>
        </ImageBackground>
    </TouchableOpacity>
);

const SearchResultItem = ({ item, onPress }) => (
    <TouchableOpacity onPress={onPress} className="flex-row items-center mb-4 p-2 rounded-lg active:bg-custom-surface-raised/50">

        <Image source={{ uri: item.artwork }} className="w-12 h-12 rounded-md mr-4" />
        <View className="flex-1">
            <Text className="text-custom-quaternary font-semibold text-base" numberOfLines={1}>{item.title}</Text>
            <Text className="text-custom-text-secondary text-sm" numberOfLines={1}>{item.artist}</Text>
        </View>
    </TouchableOpacity>
);

export default function SearchScreen() {
    const navigation = useNavigation();
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [allTracks] = useState(allTracksDataForSearch); // Используем импортированные данные

    useEffect(() => {
        if (searchText.trim() === '') {
            setSearchResults([]); return;
        }
        const lowerCaseQuery = searchText.toLowerCase();
        const filteredTracks = allTracks.filter(track =>
            track.title.toLowerCase().includes(lowerCaseQuery) ||
            track.artist.toLowerCase().includes(lowerCaseQuery) ||
            (track.album && track.album.toLowerCase().includes(lowerCaseQuery))
        );
        setSearchResults(filteredTracks);
    }, [searchText, allTracks]);

    const handleSearchResultPress = (selectedTrack) => {
        const currentIndexInResults = searchResults.findIndex(t => t.id === selectedTrack.id);
        if (searchResults.length > 0 && currentIndexInResults !== -1) {
            navigation.navigate('Player', { track: selectedTrack, playlist: searchResults, currentIndex: currentIndexInResults });
        } else {
            navigation.navigate('Player', { track: selectedTrack, playlist: [selectedTrack], currentIndex: 0 });
        }
    };

    const handleCategoryPress = (category) => {
        console.log('Category pressed (functionality to be implemented):', category.name);

    };

    return (
        <View className="flex-1 bg-custom-tertiary pt-12">
            <View className="px-5 mb-6">
                <Text className="text-custom-quaternary text-3xl font-bold">Search</Text>
            </View>
            <View className="px-5 mb-6">
                <View className="flex-row items-center bg-custom-surface-raised rounded-lg p-3.5">
                    <Ionicons name="search" size={22} color={COLOR_PLACEHOLDER} style={{marginRight: 12}}/>
                    <TextInput
                        placeholder="Artists, songs, or podcasts"
                        placeholderTextColor={COLOR_PLACEHOLDER}
                        className="flex-1 text-custom-quaternary text-base"
                        value={searchText}
                        onChangeText={setSearchText}
                        returnKeyType="search"
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => { setSearchText(''); setSearchResults([]); }} className="p-1">
                            <Ionicons name="close-circle" size={20} color={COLOR_PLACEHOLDER} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {searchText.trim() !== '' ? (
                <FlatList
                    data={searchResults}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => <SearchResultItem item={item} onPress={() => handleSearchResultPress(item)} />}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                    ListEmptyComponent={
                        <View className="items-center mt-10">
                            <Ionicons name="sad-outline" size={48} color={COLOR_ICON_INACTIVE_HEX} />
                            <Text style={{color: COLOR_ICON_INACTIVE_HEX}} className="text-lg mt-3">No results found for "{searchText}"</Text>
                        </View>
                    }
                />
            ) : (
                <ScrollView keyboardShouldPersistTaps="handled">
                    <View className="px-5 mb-4 mt-2">
                        <Text className="text-custom-quaternary text-xl font-bold">Browse all</Text>
                    </View>
                    <FlatList
                        data={searchCategories}
                        numColumns={numColumns}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => <CategoryCard item={item} onPress={() => handleCategoryPress(item)} />}
                        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 20 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        scrollEnabled={false}
                    />
                </ScrollView>
            )}
            <View className="h-10" />
        </View>
    );
}
