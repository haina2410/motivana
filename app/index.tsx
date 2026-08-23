import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Motivana</Text>
      <View
        accessible
        accessibilityLabel="Wallpaper preview"
        style={styles.preview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 24,
    backgroundColor: '#101114',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
  },
  preview: {
    flex: 1,
    marginTop: 24,
    borderRadius: 24,
    backgroundColor: '#24262B',
  },
});
