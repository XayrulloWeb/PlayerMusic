// screens/TrackListScreen.js
import React from 'react';
import { View, Text, Button } from 'react-native';
import { useNavigation } from '@react-navigation/native'; // Для перехода на экран плеера

export default function TrackListScreen() {
    const navigation = useNavigation();

    return (
        <View className="flex-1 justify-center items-center bg-custom-tertiary p-5">
            <Text className="text-2xl text-custom-quaternary mb-10">Track List</Text>
            <Text className="text-custom-quaternary mb-4 text-center">
                Здесь будет список твоих треков.
            </Text>
            <View className="bg-custom-secondary p-3 rounded-lg">
                <Button
                    title="Перейти к Плееру (Тест)"
                    onPress={() => navigation.navigate('Player')} // 'Player' - это имя экрана плеера в навигаторе
                    color="#FFFFFF" // custom-quinary для текста кнопки
                />
            </View>
        </View>
    );
}
