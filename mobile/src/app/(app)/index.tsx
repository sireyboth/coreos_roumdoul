// Home: who is signed in. The first real modules (check-in, requests, payslips) start here.
import { CalendarCheck2, FileText, LogOut, Wallet, Wifi } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { API_URL } from '@/lib/api';
import { useSession } from '@/lib/session';

/** The modules the app will grow into. Shown as "coming soon" until each is built. */
const MODULES = [
  { icon: CalendarCheck2, title: 'Check in', text: 'GPS and selfie check-in' },
  { icon: FileText, title: 'Requests', text: 'Leave, corrections, overtime' },
  { icon: Wallet, title: 'Payslips', text: 'Your monthly pay' },
] as const;

export default function Home() {
  const { me, signOut } = useSession();
  if (!me) return null;

  const name = me.employee?.name ?? me.user.name;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <View className="flex-row items-center gap-3">
          <View className="size-12 items-center justify-center rounded-full bg-accent">
            <Text className="text-base font-semibold text-accent-foreground">{initials(name)}</Text>
          </View>
          <View className="flex-1">
            <Text variant="large">Hello, {name}</Text>
            <Text variant="muted">{me.company?.name}</Text>
          </View>
        </View>

        <Card className="py-4">
          <CardHeader className="flex-row items-center gap-3 px-4">
            <View className="size-9 items-center justify-center rounded-lg bg-primary/10">
              <Icon as={Wifi} size={18} className="text-primary" />
            </View>
            <View className="flex-1">
              <CardTitle className="text-base">Connected</CardTitle>
              <CardDescription>
                {API_URL}/api/v1 · {me.roles.join(', ') || 'no role'} · {me.permissions.length} permissions
              </CardDescription>
            </View>
          </CardHeader>
        </Card>

        <View className="gap-3">
          <Text variant="small" className="text-muted-foreground">COMING NEXT</Text>
          {MODULES.map((m) => (
            <Card key={m.title} className="py-4 opacity-70">
              <CardContent className="flex-row items-center gap-3 px-4">
                <View className="size-10 items-center justify-center rounded-xl bg-muted">
                  <Icon as={m.icon} size={20} className="text-muted-foreground" />
                </View>
                <View className="flex-1">
                  <Text className="font-medium">{m.title}</Text>
                  <Text variant="muted">{m.text}</Text>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>

        <Button variant="outline" onPress={signOut}>
          <Icon as={LogOut} size={16} />
          <Text>Sign out</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}
