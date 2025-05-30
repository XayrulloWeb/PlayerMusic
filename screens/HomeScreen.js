// screens/HomeScreen.js
import React from 'react';
import { View, Text, ScrollView, FlatList, Image, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Данные треков (используем ваш предоставленный JSON)
const allTracks = [
    { "id": "track001", "title": "Midnight Cruise", "artist": "Synthwave Explorer", "album": "Neon Roads", "artwork": "https://images.unsplash.com/photo-1519681393784-d120267933ba?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YWJzdHJhY3QlMjBkYXJrJTIwbXVzaWN8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=400&q=60", "duration": 245, "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { "id": "track002", "title": "LoFi Morning Dew", "artist": "Chill Beats Collective", "album": "Study & Relax", "artwork": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8bXVzaWN8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=400&q=60", "duration": 190, "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { "id": "track003", "title": "Cybernetic Dreams", "artist": "Vector Hold", "album": "Digital Frontier", "artwork": "https://images.unsplash.com/photo-1508700115892-45ecd0562ad2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8bmVvbiUyMG11c2ljfGVufDB8fDB8fHww&auto=format&fit=crop&w=400&q=60", "duration": 210, "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
    { "id": "track004", "title": "Acoustic Serenity", "artist": "Willow Creek", "album": "Nature's Harmony", "artwork": "https://images.unsplash.com/photo-1487180144351-b8472da7d491?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8YWNvdXN0aWMlMjBtdXNpY3xlbnwwfHwwfHx8MA%3D&auto=format&fit=crop&w=400&q=60", "duration": 185, "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
    { "id": "track005", "title": "Indie Summer Anthem", "artist": "The Weekend Haze", "album": "Golden Days", "artwork": "https://images.unsplash.com/photo-1483954002438-3084c974b8is?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGluZGllJTIwbXVzaWN8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=400&q=60", "duration": 220, "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" }
];

// Формируем секции
const sectionsData = {
    recentlyPlayed: allTracks.slice(0, 4).map(track => ({ ...track, type: 'Album' })),
    madeForYou: allTracks.slice(1, 5).reverse().map(track => ({ ...track, type: 'Playlist' })),
    newReleases: [allTracks[0], allTracks[2], allTracks[4]].map(track => ({ ...track, type: 'Single' })),
};

// Цвета из Tailwind config (для удобства доступа в StyleSheet или где Tailwind классы не прям удобны)
// Эти значения должны совпадать с вашим tailwind.config.js
const themeColors = {
    primary: '#8DEEED',       // custom-primary
    secondary: '#7037E4',     // custom-secondary
    tertiary: '#030318',      // custom-tertiary (фон)
    quaternary: '#FAFAFA',    // custom-quaternary (основной текст)
    surface: '#0F0F2B',       // Предположим, это ваш 'custom-surface-raised' или аналог для фона карточек
    // Если нет, можно использовать bg-neutral-800 или bg-zinc-800 как альтернативу.
    // Я буду использовать 'bg-zinc-800' как пример, если 'custom-surface' не определен.
    textSecondary: '#A0A0A0', // Предположим, это для второстепенного текста (как text-neutral-400)
};

// Компонент для карточки
const ContentCard = ({ item, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        // Используем bg-zinc-800 как хороший темный фон для карточек.
        // Если у вас есть 'custom-surface', используйте его: className="... bg-custom-surface ..."
        // Тень: shadow-md - стандартная, shadow-lg - побольше. Для темных тем тени менее заметны.
        // Можно добавить легкую границу, если тени не видны: border border-zinc-700
        className="w-36 mr-4 bg-[#0e1133] p-3 rounded-lg shadow-md active:bg-[#0e1190]"
    >
        <Image
            source={{ uri: item.artwork || 'https://via.placeholder.com/150?text=No+Art' }}
            // bg-zinc-700 как плейсхолдер фона для Image
            className="w-full h-32 rounded-md mb-2 bg-[#fff]"
        />
        <Text className="text-custom-quaternary font-semibold text-sm" numberOfLines={1}>{item.title}</Text>
        <Text
            // Используем text-neutral-400, так как он хорошо смотрится для второстепенного текста.
            // Если у вас есть свой 'text-custom-text-secondary', используйте его.
            className="text-neutral-400 text-xs"
            numberOfLines={1}
        >
            {item.type === 'Album' || item.type === 'Single' ? item.artist : item.type}
        </Text>
    </TouchableOpacity>
);

// Компонент для секции
const HorizontalSection = ({ title, data, onCardPress }) => (
    <View className="mb-6"> {/* Уменьшил mb до 6 */}
        <Text className="text-custom-quaternary text-xl font-bold px-5 mb-3">{title}</Text>
        <FlatList
            data={data}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
                <ContentCard
                    item={item}
                    onPress={() => onCardPress(item, data)}
                />
            )}
            contentContainerStyle={styles.flatListContentContainer}
        />
    </View>
);

export default function HomeScreen() {
    const navigation = useNavigation();

    const handleCardPress = (selectedTrack, playlistContext) => {
        console.log('Card pressed:', selectedTrack.title);
        const currentIndex = playlistContext.findIndex(track => track.id === selectedTrack.id);
        navigation.navigate('Player', {
            track: selectedTrack,
            playlist: playlistContext,
            currentIndex: currentIndex !== -1 ? currentIndex : 0,
        });
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    return (
        <ScrollView
            className="flex-1 bg-custom-tertiary" // Основной фон из Tailwind
            style={styles.scrollViewContainer}
            contentContainerStyle={styles.scrollViewContentContainer}
            showsVerticalScrollIndicator={false}
        >
            {/* Статус бар */}
            <StatusBar barStyle="light-content" backgroundColor={themeColors.tertiary} />

            {/* Заголовок-приветствие */}
            <View className="px-5 mt-4 mb-5 flex-row justify-between items-center"> {/* Уменьшил mb до 5, добавил mt-4 */}
                <Text className="text-custom-quaternary text-2xl font-bold">{getGreeting()}</Text>
                <View className="flex-row">
                    <TouchableOpacity onPress={() => console.log('Notifications pressed')} className="p-2 mr-1">
                        <Ionicons name="notifications-outline" size={24} color={themeColors.quaternary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => console.log('Settings pressed')} className="p-2 ml-1">
                        <Ionicons name="settings-outline" size={24} color={themeColors.quaternary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Фильтры-чипсы */}
            <View className="px-5 mb-6">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollViewContent}>
                    {['Music', 'Podcasts', 'Audiobooks'].map(chip => (
                        <TouchableOpacity
                            key={chip}
                            // bg-zinc-800 для чипсов, как и для карточек. active: для эффекта нажатия.
                            className="bg-[#0e1133] px-4 py-2 rounded-full mr-2 active:bg-zinc-700"
                        >
                            <Text className="text-custom-quaternary text-sm font-medium">{chip}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <HorizontalSection
                title="Recently Played"
                data={sectionsData.recentlyPlayed}
                onCardPress={handleCardPress}
            />
            <HorizontalSection
                title="Made For You"
                data={sectionsData.madeForYou}
                onCardPress={handleCardPress}
            />
            <HorizontalSection
                title="New Releases"
                data={sectionsData.newReleases}
                onCardPress={handleCardPress}
            />
            {/* Дополнительные секции можно добавить здесь */}

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollViewContainer: {
        // paddingTop для iOS, если используется SafeAreaView или аналогичная логика на уровне App.js
        // Для Android StatusBar.currentHeight может быть использован, если нет глобального paddingTop
        // Если App.js уже обрабатывает отступы для StatusBar/Notch, этот paddingTop может быть не нужен.
        // Я предполагаю, что App.js добавляет pt-12 (что ~48dp), что может быть многовато для контента
        // Если ваш `pt-12` в App.js - это `paddingTop`, то здесь не нужно. Если это `marginTop`, то нужно.
    },
    scrollViewContentContainer: {
        paddingBottom: 90, // Увеличил отступ снизу для таб-бара
        // Если App.js не задает paddingTop для ScrollView через родительский View, то здесь нужен:
        // paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10,
        // Убираем paddingTop если он глобально в App.js, чтобы избежать двойного отступа
    },
    flatListContentContainer: {
        paddingHorizontal: 20,
        paddingRight: Platform.OS === 'ios' ? 20 : 30, // Небольшая коррекция для тени на Android
    },
    chipsScrollViewContent: {
        paddingRight: 10, // Чтобы последний чипс не прилипал к краю
    }
});
