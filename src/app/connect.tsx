import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionCard } from '@/components/SectionCard';
import { colors, radius, spacing } from '@/constants/theme';
import { useServerConnection } from '@/context/ServerConnectionContext';
import type { ServerDiscovery } from '@/lib/serverApi';

type ScreenStep = 'server' | 'setup' | 'login';

export default function ConnectScreen() {
  const { discover, setup, login, lastConnectionError } = useServerConnection();
  const [step, setStep] = useState<ScreenStep>('server');
  const [serverInput, setServerInput] = useState('http://127.0.0.1:8080');
  const [discovery, setDiscovery] = useState<ServerDiscovery | null>(null);
  const [serverName, setServerName] = useState('LiftFlow');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(lastConnectionError);

  const checkServer = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await discover(serverInput);
      setDiscovery(result);
      setServerInput(result.serverUrl);
      setServerName(result.auth.serverName || result.info.name);
      setStep(result.auth.setupRequired ? 'setup' : 'login');
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  };

  const createOwner = async () => {
    if (!discovery || busy) return;
    if (password.length < 12) {
      setError('Use a password containing at least 12 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setup(discovery, { serverName, displayName, username, password });
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    if (!discovery || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(discovery, { username, password });
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  };

  const editServer = () => {
    setStep('server');
    setDiscovery(null);
    setPassword('');
    setConfirmPassword('');
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.shell}>
            <View style={styles.brandRow}>
              <View style={styles.logo}><Text style={styles.logoText}>LF</Text></View>
              <View style={styles.brandCopy}>
                <Text style={styles.title}>LiftFlow</Text>
                <Text style={styles.subtitle}>Connect to your private workout server</Text>
              </View>
            </View>

            {step === 'server' ? (
              <SectionCard title="Server address">
                <Text style={styles.instructions}>
                  Enter the address of the computer or home server running LiftFlow Docker.
                </Text>
                <Field
                  label="LiftFlow server URL"
                  value={serverInput}
                  onChangeText={setServerInput}
                  placeholder="http://192.168.1.50:8080"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  textContentType="URL"
                />
                <PrimaryButton
                  label={busy ? 'Checking server…' : 'Connect to Server'}
                  onPress={() => { void checkServer(); }}
                  disabled={busy || !serverInput.trim()}
                />
                <Text style={styles.hint}>
                  Simulator on this Mac: http://127.0.0.1:8080{`\n`}
                  Physical phone: use the Docker computer’s LAN address.
                </Text>
              </SectionCard>
            ) : null}

            {discovery && step !== 'server' ? (
              <SectionCard
                title={step === 'setup' ? 'Create server owner' : 'Owner sign in'}
                headerRight={<StatusPill label={`API ${discovery.info.apiVersion}`} />}
              >
                <View style={styles.serverSummary}>
                  <Text style={styles.serverName}>{discovery.auth.serverName}</Text>
                  <Text style={styles.serverDetail}>{discovery.serverUrl}</Text>
                  <Text style={styles.serverDetail}>Server {discovery.info.serverVersion}</Text>
                </View>

                {step === 'setup' ? (
                  <>
                    <Text style={styles.instructions}>
                      This is the only owner account this Docker installation will allow.
                    </Text>
                    <Field label="Server name" value={serverName} onChangeText={setServerName} placeholder="Home LiftFlow" />
                    <Field label="Your name" value={displayName} onChangeText={setDisplayName} placeholder="Corey" textContentType="name" />
                    <Field label="Username" value={username} onChangeText={setUsername} placeholder="cheech" autoCapitalize="none" autoCorrect={false} textContentType="username" />
                    <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 12 characters" secureTextEntry autoCapitalize="none" textContentType="newPassword" />
                    <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Enter it again" secureTextEntry autoCapitalize="none" textContentType="newPassword" />
                    <PrimaryButton
                      label={busy ? 'Creating owner…' : 'Create Owner and Connect'}
                      onPress={() => { void createOwner(); }}
                      disabled={busy || !serverName.trim() || !displayName.trim() || !username.trim() || !password}
                    />
                  </>
                ) : (
                  <>
                    <Field label="Username" value={username} onChangeText={setUsername} placeholder="Username" autoCapitalize="none" autoCorrect={false} textContentType="username" />
                    <Field label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry autoCapitalize="none" textContentType="password" />
                    <PrimaryButton
                      label={busy ? 'Signing in…' : 'Sign In'}
                      onPress={() => { void signIn(); }}
                      disabled={busy || !username.trim() || !password}
                    />
                  </>
                )}

                <PrimaryButton label="Use a Different Server" variant="secondary" onPress={editServer} disabled={busy} />
              </SectionCard>
            ) : null}

            {error ? (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <Text style={styles.errorTitle}>Could not connect</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.safetyBox}>
              <Text style={styles.safetyTitle}>Your current workouts stay safe</Text>
              <Text style={styles.safetyText}>
                LF-035 only connects and authenticates this app. It does not upload, replace, or delete local workout data.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        style={styles.input}
      />
    </View>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <View style={styles.pillDot} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : 'LiftFlow could not complete the server connection.';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },
  shell: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: spacing.md, paddingTop: spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  brandCopy: { flex: 1 },
  logo: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.primary },
  logoText: { color: colors.primary, fontSize: 23, fontWeight: '900', letterSpacing: -1 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  instructions: { color: colors.text, fontSize: 15, lineHeight: 21 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.text, paddingHorizontal: spacing.md, fontSize: 16 },
  serverSummary: { gap: 2, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  serverName: { color: colors.text, fontSize: 19, fontWeight: '800' },
  serverDetail: { color: colors.textMuted, fontSize: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: 'rgba(100, 217, 139, 0.12)' },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  pillText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  errorBox: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: 'rgba(255, 107, 107, 0.08)', padding: spacing.md, gap: 4 },
  errorTitle: { color: colors.danger, fontSize: 14, fontWeight: '900' },
  errorText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  safetyBox: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  safetyTitle: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  safetyText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
