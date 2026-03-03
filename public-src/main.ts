import { renderLibrary, destroyLibrary } from './library';
import { renderPlayer, destroyPlayer } from './player';

type Screen = 'library' | 'player';
let currentScreen: Screen = 'library';

const app = document.getElementById('app')!;

export function navigateTo(screen: Screen, fileId?: string, playlistId?: string) {
  // Destroy previous screen
  if (currentScreen === 'library') destroyLibrary();
  if (currentScreen === 'player') destroyPlayer();

  currentScreen = screen;
  app.innerHTML = '';

  if (screen === 'library') {
    renderLibrary(app);
  } else if (screen === 'player' && fileId) {
    renderPlayer(app, fileId, playlistId);
  }
}

// Initial load
navigateTo('library');
