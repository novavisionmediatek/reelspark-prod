import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { FeedScreen } from '../screens/FeedScreen';
import { SubmitScreen } from '../screens/SubmitScreen';
import { MyVideosScreen } from '../screens/MyVideosScreen';
import { ProfileStackNavigator } from './ProfileStackNavigator';
import { colors } from '../theme/tokens';
import { useResponsive } from '../theme/responsive';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Feather.glyphMap> = {
  Feed: 'film',
  Submit: 'plus-circle',
  MyVideos: 'grid',
  Profile: 'user',
};

export function MainTabNavigator() {
  const { sidebarNav } = useResponsive();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Bottom bar below 1000px; a left nav rail at 1000px and up.
        tabBarPosition: sidebarNav ? 'left' : 'bottom',
        tabBarVariant: sidebarNav ? 'material' : 'uikit',
        tabBarActiveTintColor: colors.pink,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarActiveIndicatorStyle: { backgroundColor: 'rgba(253,54,103,0.16)' },
        tabBarStyle: sidebarNav
          ? { backgroundColor: colors.surface, borderRightColor: colors.border, borderRightWidth: 1 }
          : { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
        tabBarIcon: ({ color, size }) => (
          <Feather name={ICONS[route.name as keyof MainTabParamList]} size={size - 2} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Submit" component={SubmitScreen} options={{ title: 'Submit' }} />
      <Tab.Screen name="MyVideos" component={MyVideosScreen} options={{ title: 'My Videos' }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}
