// Sign in. Staff use company code + employee ID; admins use their email (same as the web app).
import { Building2, IdCard, LockKeyhole, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

type Mode = 'staff' | 'email';

export default function SignIn() {
  const { signIn } = useSession();
  const [mode, setMode] = useState<Mode>('staff');
  const [company, setCompany] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = password.length > 0 && (mode === 'staff' ? !!company && !!employeeId : !!email) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(mode === 'staff' ? { company: company.trim(), employee_id: employeeId.trim(), password } : { email: email.trim(), password });
    } catch (err) {
      // The server's message is already in plain words (and in the app's language).
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="flex-grow justify-center gap-6 p-6" keyboardShouldPersistTaps="handled">
          <View className="items-center gap-3">
            <View className="size-16 items-center justify-center rounded-2xl bg-primary">
              <Icon as={Building2} size={30} className="text-primary-foreground" />
            </View>
            <Text variant="h3" className="text-center">Business OS</Text>
            <Text variant="muted" className="text-center">Sign in to check in, send requests and see your payslips.</Text>
          </View>

          <Card className="gap-4 py-5">
            <CardContent className="gap-4 px-5">
              <View className="flex-row gap-1 rounded-xl bg-muted p-1">
                {(['staff', 'email'] as const).map((m) => (
                  <Pressable
                    key={m}
                    accessibilityRole="button"
                    accessibilityState={{ selected: mode === m }}
                    onPress={() => setMode(m)}
                    className={cn('h-10 flex-1 flex-row items-center justify-center gap-2 rounded-lg', mode === m && 'bg-background shadow-sm shadow-black/5')}>
                    <Icon as={m === 'staff' ? IdCard : Mail} size={16} className={mode === m ? 'text-foreground' : 'text-muted-foreground'} />
                    <Text className={cn('text-sm font-medium', mode === m ? 'text-foreground' : 'text-muted-foreground')}>
                      {m === 'staff' ? 'Employee ID' : 'Email'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {mode === 'staff' ? (
                <>
                  <Field label="Company code" id="company">
                    <Input id="company" value={company} onChangeText={setCompany} autoCapitalize="none" autoCorrect={false} placeholder="e.g. roumdoul" />
                  </Field>
                  <Field label="Employee ID" id="employee-id">
                    <Input id="employee-id" value={employeeId} onChangeText={setEmployeeId} autoCapitalize="characters" autoCorrect={false} placeholder="e.g. E-001" />
                  </Field>
                </>
              ) : (
                <Field label="Email" id="email">
                  <Input id="email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="you@company.com" />
                </Field>
              )}
              <Field label="Password" id="password">
                <Input id="password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} returnKeyType="go" />
              </Field>

              {error && (
                <View accessibilityRole="alert" className="rounded-lg bg-destructive/10 px-3 py-2">
                  <Text className="text-sm text-destructive">{error}</Text>
                </View>
              )}

              <Button size="lg" disabled={!canSubmit} onPress={submit} className="mt-1">
                {busy ? <ActivityIndicator color="white" /> : <Icon as={LockKeyhole} className="text-primary-foreground" size={16} />}
                <Text>Sign in</Text>
              </Button>
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Label nativeID={id}>{label}</Label>
      {children}
    </View>
  );
}
