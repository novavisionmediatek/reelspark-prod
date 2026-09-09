import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/lib/AuthProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { captureReferralFromUrl } from './src/lib/referral';
import { colors } from './src/theme/tokens';

// Lift ?ref=CODE out of the invite link before anything renders.
captureReferralFromUrl();

const queryClient = new QueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <RootNavigator />
          </View>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
