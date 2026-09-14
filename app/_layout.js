import '../global.css';
import { Stack } from 'expo-router';
import { THEME } from '../constants/theme';
import { TransactionProvider } from '../context/TransactionContext';
import { AuthProvider } from '../context/AuthContext';

export default function Layout() {
  return (
    <AuthProvider>
      <TransactionProvider>
        <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: THEME.colors.primary,
          },
          headerTintColor: THEME.colors.card,
          headerTitleStyle: {
            fontWeight: THEME.typography.weights.bold,
          },
          contentStyle: {
            backgroundColor: THEME.colors.background,
          }
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Mill System' }} />
        <Stack.Screen name="login" options={{ title: 'Login', headerShown: false }} />
        <Stack.Screen name="create-account" options={{ title: 'Create Account', headerShown: false }} />
        <Stack.Screen name="home" options={{ title: 'Home', headerLeft: () => null }} />
        <Stack.Screen name="parties" options={{ title: 'Parties Directory' }} />
        <Stack.Screen name="party-transactions" options={{ title: 'Party Transactions' }} />
        <Stack.Screen name="party-timeline" options={{ title: 'Party History Statement' }} />
        <Stack.Screen name="products" options={{ title: 'Products & Varieties' }} />
        <Stack.Screen name="select-party" options={{ title: 'Select Party' }} />
        <Stack.Screen name="select-products" options={{ title: 'Select Products' }} />
        <Stack.Screen name="select-varieties" options={{ title: 'Select Varieties' }} />
        <Stack.Screen name="transaction/calculator" options={{ title: 'Weighing Calculator' }} />
        <Stack.Screen name="transaction/history" options={{ title: 'Weight History' }} />
        <Stack.Screen name="transaction/summary" options={{ title: 'Review Weights' }} />
        <Stack.Screen name="transaction/rate-entry" options={{ title: 'Apply Rates' }} />
        <Stack.Screen name="transaction/final-review" options={{ title: 'Final Review' }} />
        <Stack.Screen name="transaction/bill-preview" options={{ title: 'Bill' }} />
        <Stack.Screen name="bill-preview" options={{ headerShown: false }} />
      </Stack>
    </TransactionProvider>
    </AuthProvider>
  );
}
