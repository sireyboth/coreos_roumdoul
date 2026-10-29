// Screens for a signed-in person. Add modules here as they come (attendance, requests, payslips,
// then sales and stock — shown only when the company has that module, from /me).
import { Stack } from 'expo-router';

export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
