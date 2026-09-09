import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabNavigator } from './MainTabNavigator';
import { PaymentScreen } from '../screens/PaymentScreen';
import type { MainStackParamList } from './types';

const Stack = createNativeStackNavigator<MainStackParamList>();

// Wraps the tab navigator so the registration Payment screen can be pushed over
// it from Submit / Profile without blocking the browse-only tabs.
export function MainStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabNavigator} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
