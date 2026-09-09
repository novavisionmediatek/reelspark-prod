import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useAuth } from '../lib/AuthProvider';
import { useUpdateProfile, useUploadAvatar } from '../hooks/useUpdateProfile';
import { colors, fonts, spacing, type } from '../theme/tokens';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [youtubeHandle, setYoutubeHandle] = useState(profile?.youtube_handle ?? '');
  const [instagramHandle, setInstagramHandle] = useState(profile?.instagram_handle ?? '');

  const initials = (displayName || '??').slice(0, 2).toUpperCase();

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      uploadAvatar.mutate(result.assets[0].uri);
    }
  }

  function handleSave() {
    updateProfile.mutate(
      {
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        phone: phone.trim() || null,
        youtube_handle: youtubeHandle.trim() || null,
        instagram_handle: instagramHandle.trim() || null,
      },
      { onSuccess: () => navigation.goBack() }
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="x" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Edit profile</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.avatarWrap} onPress={handlePickAvatar}>
          <Avatar initials={initials} imageUri={profile?.avatar_url} size={84} />
          <View style={styles.avatarEditBadge}>
            {uploadAvatar.isPending ? (
              <Feather name="loader" size={12} color="#fff" />
            ) : (
              <Feather name="camera" size={12} color="#fff" />
            )}
          </View>
        </Pressable>
        <Text style={styles.avatarHint}>Tap to change photo</Text>

        <Text style={styles.label}>Display name</Text>
        <TextField value={displayName} onChangeText={setDisplayName} placeholder="Your name" />

        <Text style={styles.label}>Bio</Text>
        <TextField value={bio} onChangeText={setBio} placeholder="Editor & motion designer." multiline />

        <Text style={styles.label}>Phone (optional)</Text>
        <TextField value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+1 555 000 0000" />

        <Text style={styles.label}>YouTube handle</Text>
        <TextField value={youtubeHandle} onChangeText={setYoutubeHandle} autoCapitalize="none" placeholder="@yourchannel" />

        <Text style={styles.label}>Instagram handle</Text>
        <TextField value={instagramHandle} onChangeText={setInstagramHandle} autoCapitalize="none" placeholder="@yourhandle" />

        {updateProfile.isError && (
          <Text style={styles.errorText}>{(updateProfile.error as Error)?.message ?? 'Could not save changes.'}</Text>
        )}

        <Button
          label={updateProfile.isPending ? 'Saving…' : 'Save changes'}
          onPress={handleSave}
          loading={updateProfile.isPending}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { ...type.h3, color: colors.text },
  content: { padding: spacing.xl, alignItems: 'center', gap: spacing.xs },
  avatarWrap: { position: 'relative', marginTop: spacing.sm },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.pink,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11.5, marginBottom: spacing.md },
  label: {
    ...type.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  errorText: { color: colors.coral, fontFamily: fonts.body, fontSize: 12, marginTop: spacing.md, textAlign: 'center' },
});
