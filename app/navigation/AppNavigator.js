import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CanvasScreen from '../../src/screens/CanvasScreen';
import RecognitionScreen from '../../src/screens/RecognitionScreen';
import CollaborationScreen from '../../src/screens/CollaborationScreen';
import SaveScreen from '../../src/screens/SaveScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Canvas">
        <Stack.Screen 
          name="Canvas" 
          component={CanvasScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Recognition" 
          component={RecognitionScreen}
          options={{ title: 'Text Recognition' }}
        />
        <Stack.Screen 
          name="Save" 
          component={SaveScreen}
          options={{ title: 'Saved Items' }}
        />
        <Stack.Screen 
          name="Collaboration" 
          component={CollaborationScreen}
          options={{ title: 'Collaboration' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
